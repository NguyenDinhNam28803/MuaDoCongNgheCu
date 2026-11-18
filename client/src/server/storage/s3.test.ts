import { beforeAll, describe, expect, it } from "vitest";
import { StorageError, createUploadUrl, createViewUrl, publicUrl } from "./s3";

// Project unit không nạp .env → gán cấu hình giả; presign tính cục bộ, không gọi mạng.
beforeAll(() => {
  Object.assign(process.env, {
    S3_ENDPOINT: "http://localhost:8333",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test-secret",
    S3_PUBLIC_BUCKET: "muaban-public",
    S3_PRIVATE_BUCKET: "muaban-private",
    S3_PUBLIC_BASE_URL: "http://localhost:8333/muaban-public",
    S3_FORCE_PATH_STYLE: "true",
  });
});

describe("createUploadUrl", () => {
  it("presigns a 5-minute PUT into the public bucket for device photos", async () => {
    const { key, url } = await createUploadUrl("device", "image/webp", 300_000);
    expect(key).toMatch(/^devices\//);
    expect(url).toContain("/muaban-public/");
    expect(url).toContain(encodeURI(key));
    expect(url).toContain("X-Amz-Expires=300");
  });

  it("uses the private bucket for id documents", async () => {
    const { url } = await createUploadUrl("id-doc", "image/jpeg", 100_000);
    expect(url).toContain("/muaban-private/");
  });

  it("rejects unsupported types", async () => {
    await expect(createUploadUrl("device", "image/gif", 1000)).rejects.toThrow(new StorageError("Định dạng ảnh không hỗ trợ"));
  });

  it("rejects files over 2MB and empty files", async () => {
    await expect(createUploadUrl("device", "image/webp", 3_000_000)).rejects.toThrow(new StorageError("Ảnh quá lớn"));
    await expect(createUploadUrl("device", "image/webp", 0)).rejects.toThrow(StorageError);
  });
});

describe("view urls", () => {
  it("signs private id-doc views for 5 minutes", async () => {
    const url = await createViewUrl("id-doc", "id-docs/2026/11/abcdef0123456789abcdef01.webp");
    expect(url).toContain("/muaban-private/id-docs/2026/11/");
    expect(url).toContain("X-Amz-Expires=300");
  });

  it("refuses to sign a key of another kind", async () => {
    await expect(createViewUrl("id-doc", "devices/2026/11/abcdef0123456789abcdef01.webp")).rejects.toThrow(StorageError);
  });

  it("builds public device urls", () => {
    expect(publicUrl("devices/2026/11/a.webp")).toBe("http://localhost:8333/muaban-public/devices/2026/11/a.webp");
  });
});
