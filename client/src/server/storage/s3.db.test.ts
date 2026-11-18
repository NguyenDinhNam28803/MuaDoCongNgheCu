// Tích hợp với kho ảnh thật (SeaweedFS trong docker-compose). Cần: pnpm db:up && pnpm storage:init
import { describe, expect, it } from "vitest";
import { createUploadUrl, createViewUrl, objectExists, publicUrl } from "./s3";

const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]);

async function upload(kind: "device" | "id-doc") {
  const { key, url } = await createUploadUrl(kind, "image/webp", webp.byteLength);
  const res = await fetch(url, { method: "PUT", body: webp, headers: { "Content-Type": "image/webp" } });
  expect(res.ok).toBe(true);
  return key;
}

describe("S3 round trip", () => {
  it("uploads a device photo via presigned PUT and serves it publicly", async () => {
    const key = await upload("device");
    expect(await objectExists("device", key)).toBe(true);
    const res = await fetch(publicUrl(key));
    expect(res.status).toBe(200);
  });

  it("keeps id documents private but viewable through a signed URL", async () => {
    const key = await upload("id-doc");
    expect(await objectExists("id-doc", key)).toBe(true);
    const base = process.env.S3_ENDPOINT;
    expect((await fetch(`${base}/${process.env.S3_PRIVATE_BUCKET}/${key}`)).ok).toBe(false);
    expect((await fetch(await createViewUrl("id-doc", key))).status).toBe(200);
  });

  it("reports missing objects and foreign keys as absent", async () => {
    expect(await objectExists("device", "devices/2026/11/000000000000000000000000.webp")).toBe(false);
    expect(await objectExists("id-doc", "devices/2026/11/000000000000000000000000.webp")).toBe(false);
  });
});
