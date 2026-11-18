// Kho ảnh S3-compatible (SeaweedFS khi dev, Cloudflare R2 khi chạy thật).
// Trình duyệt PUT thẳng lên presigned URL; server chỉ cấp URL và kiểm tra key khi lưu.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageConfig, type StorageConfig } from "./config";
import { buildPhotoKey, isKeyOfKind, type PhotoKind } from "./keys";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const URL_TTL_SECONDS = 300;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

let cached: { key: string; client: S3Client; cfg: StorageConfig } | null = null;

function storage() {
  const cfg = getStorageConfig();
  const cacheKey = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (!cached || cached.key !== cacheKey) {
    cached = {
      key: cacheKey,
      cfg,
      client: new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        forcePathStyle: cfg.forcePathStyle,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      }),
    };
  }
  return cached;
}

export function bucketFor(kind: PhotoKind, cfg: StorageConfig): string {
  return kind === "id-doc" ? cfg.privateBucket : cfg.publicBucket;
}

export async function createUploadUrl(
  kind: PhotoKind,
  contentType: string,
  size: number,
  now: Date = new Date(),
): Promise<{ key: string; url: string }> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw new StorageError("Định dạng ảnh không hỗ trợ");
  }
  if (!Number.isFinite(size) || size <= 0) throw new StorageError("Ảnh không hợp lệ");
  if (size > MAX_UPLOAD_BYTES) throw new StorageError("Ảnh quá lớn");

  const { client, cfg } = storage();
  const key = buildPhotoKey(kind, now);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucketFor(kind, cfg), Key: key, ContentType: contentType }),
    { expiresIn: URL_TTL_SECONDS },
  );
  return { key, url };
}

/** URL xem ảnh riêng tư (giấy tờ), hết hạn sau 5 phút. */
export async function createViewUrl(kind: "id-doc", key: string): Promise<string> {
  if (!isKeyOfKind(key, kind)) throw new StorageError("Ảnh không hợp lệ");
  const { client, cfg } = storage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucketFor(kind, cfg), Key: key }), {
    expiresIn: URL_TTL_SECONDS,
  });
}

/** URL công khai cho ảnh máy. */
export function publicUrl(key: string): string {
  return `${getStorageConfig().publicBaseUrl}/${key}`;
}

export async function objectExists(kind: PhotoKind, key: string): Promise<boolean> {
  if (!isKeyOfKind(key, kind)) return false;
  const { client, cfg } = storage();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketFor(kind, cfg), Key: key }));
    return true;
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return false;
    throw e;
  }
}
