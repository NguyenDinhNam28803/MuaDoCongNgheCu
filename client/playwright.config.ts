import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// E2E chạy trên DB test (muaban_test) và Chrome cài sẵn trên máy, cổng 3100.
const PORT = 3100;
const testDbUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // Dev server biên dịch trang lần đầu có thể mất vài giây.
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    ...devices["Pixel 7"],
  },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: testDbUrl ?? "", NEXT_DIST_DIR: ".next-e2e", E2E_TEST: "1" },
  },
});
