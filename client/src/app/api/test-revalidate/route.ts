// CHỈ dùng cho E2E: xóa cache website sau khi test ghi thẳng vào DB.
// Tắt hoàn toàn (404) trừ khi E2E_TEST=1 — playwright.config.ts đặt biến này cho dev server riêng.
import { revalidateTag } from "next/cache";
import { connection } from "next/server";

export async function POST() {
  await connection();
  if (process.env.E2E_TEST !== "1") return new Response("Not found", { status: 404 });
  revalidateTag("devices", { expire: 0 });
  revalidateTag("shop", { expire: 0 });
  return Response.json({ ok: true });
}
