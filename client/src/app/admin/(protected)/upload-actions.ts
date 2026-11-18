"use server";

import { requirePermission } from "@/lib/auth/dal";
import type { PhotoKind } from "@/server/storage/keys";
import { StorageError, createUploadUrl } from "@/server/storage/s3";

/** Cấp presigned URL để trình duyệt tải ảnh (đã nén) thẳng lên kho ảnh. */
export async function requestUploadAction(
  kind: PhotoKind,
  contentType: string,
  size: number,
): Promise<{ key: string; url: string } | { error: string }> {
  await requirePermission(kind === "id-doc" ? "device.intake" : "device.inspect");
  if (kind !== "id-doc" && kind !== "device") return { error: "Loại ảnh không hợp lệ" };
  try {
    return await createUploadUrl(kind, contentType, size);
  } catch (e) {
    if (e instanceof StorageError) return { error: e.message };
    throw e;
  }
}
