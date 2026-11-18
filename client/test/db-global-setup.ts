import "dotenv/config";
import { execSync } from "node:child_process";

/**
 * Áp migration vào DB test (muaban_test) trước khi chạy test tích hợp.
 * Không reset DB: từng file test tự dọn bảng trong beforeEach.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL chưa được cấu hình (xem .env.example)");
  if (!/muaban_test/.test(url)) throw new Error("TEST_DATABASE_URL phải trỏ tới DB test, không phải DB thật");

  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
