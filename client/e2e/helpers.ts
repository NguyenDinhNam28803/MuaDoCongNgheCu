import "dotenv/config";
import { expect, type Page } from "@playwright/test";
import { createUser, resetDb, testDb } from "../test/db";

export { createUser, resetDb, testDb };

export async function login(page: Page, phone: string, password = "doimatkhau") {
  await page.goto("/admin/login");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  // Lần đầu dev server biên dịch trang có thể mất >5s.
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 30_000 });
}

/** Xóa cache website (chỉ chạy được khi dev server bật E2E_TEST=1). */
export async function clearShopCache(page: Page) {
  const res = await page.request.post("/api/test-revalidate");
  expect(res.ok()).toBe(true);
}
