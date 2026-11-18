import { expect, test } from "@playwright/test";
import { createUser, login, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
});

test("chủ thêm nhân viên, khóa nhân viên thì nhân viên bị đăng xuất ngay", async ({ page, browser }) => {
  await login(page, "0900000000");
  await page.goto("/admin/nhan-vien");
  await page.getByLabel("Tên nhân viên").fill("Nhân viên Bình");
  await page.getByLabel("Số điện thoại").fill("090 111 2222");
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Nhân viên Bình" });
  await expect(row).toContainText("0901112222");
  await expect(row).toContainText("Đang hoạt động");

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, "0901112222", "matkhau123");
  await expect(staffPage.getByRole("heading", { name: "Xin chào, Nhân viên Bình" })).toBeVisible();

  await row.getByRole("button", { name: "Khóa" }).click();
  await expect(row).toContainText("Đã khóa");

  await staffPage.reload();
  await expect(staffPage).toHaveURL(/\/admin\/login/);
  await staffContext.close();
});

test("trùng số điện thoại hiện lỗi", async ({ page }) => {
  await login(page, "0900000000");
  await page.goto("/admin/nhan-vien");
  await page.getByLabel("Tên nhân viên").fill("Trùng");
  await page.getByLabel("Số điện thoại").fill("0900000000");
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Thêm nhân viên" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "đã được dùng" })).toBeVisible();
});

test("nhân viên mở trang quản lý nhân viên thấy trang 404", async ({ page }) => {
  await createUser({ phone: "0911111111", role: "STAFF" });
  await login(page, "0911111111");
  // Trang stream nên mã HTTP là 200 + giao diện 404 + noindex (docs loading.md "Status codes").
  await page.goto("/admin/nhan-vien");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.getByText("Thêm nhân viên")).toHaveCount(0);
});
