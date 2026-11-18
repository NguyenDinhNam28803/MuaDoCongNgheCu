import { randomBytes } from "node:crypto";

/** id-doc: giấy tờ người bán (bucket riêng tư). device: ảnh máy (bucket công khai, dùng ở P4). */
export type PhotoKind = "id-doc" | "device";

const PREFIX: Record<PhotoKind, string> = { "id-doc": "id-docs", device: "devices" };

export function buildPhotoKey(kind: PhotoKind, now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${PREFIX[kind]}/${yyyy}/${mm}/${randomBytes(12).toString("hex")}.webp`;
}

/** Chỉ chấp nhận đúng định dạng key do buildPhotoKey sinh ra — chặn key giả / path traversal. */
export function isKeyOfKind(key: string, kind: PhotoKind): boolean {
  return new RegExp(`^${PREFIX[kind]}/\\d{4}/\\d{2}/[a-f0-9]{24}\\.webp$`).test(key);
}
