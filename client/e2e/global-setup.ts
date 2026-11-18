import "dotenv/config";
import { execSync } from "node:child_process";

/** Áp migration lên DB test trước khi chạy E2E. Từng spec tự reset + tạo dữ liệu. */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/muaban_test/.test(url)) throw new Error("TEST_DATABASE_URL phải trỏ tới DB test");
  execSync("pnpm exec prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
