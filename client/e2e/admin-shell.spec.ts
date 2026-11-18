import { expect, test } from "@playwright/test";
import { createUser, login, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
  await createUser({ phone: "0911111111", role: "STAFF", name: "Nhân viên A" });
});

test("OWNER trên điện thoại: thanh đáy 4 mục + Thêm chứa mục của chủ", async ({ page }) => {
  await login(page, "0900000000");
  await expect(page.getByRole("heading", { name: "Xin chào, Chủ shop" })).toBeVisible();
  await expect(page.getByRole("banner").getByText("Chủ cửa hàng", { exact: true })).toBeVisible();

  const bottom = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(bottom.getByRole("link")).toHaveText(["Tổng quan", "Kho", "Nhập máy", "Bán hàng"]);

  await bottom.getByRole("button", { name: "Thêm" }).click();
  const more = page.getByRole("dialog");
  await expect(more.getByRole("link")).toHaveText(["Đơn hàng", "Báo cáo", "Catalog", "Nhân viên", "Cài đặt"]);
  await expect(more.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});

test("STAFF không thấy Báo cáo, Catalog, Nhân viên", async ({ page }) => {
  await login(page, "0911111111");
  await expect(page.getByRole("banner").getByText("Nhân viên", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Thêm" }).click();
  const more = page.getByRole("dialog");
  await expect(more.getByRole("link")).toHaveText(["Đơn hàng"]);
});

test("Đăng xuất về trang đăng nhập; Back không mở lại trang quản trị", async ({ page }) => {
  await login(page, "0900000000");
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name: "Thêm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/login/);
});
