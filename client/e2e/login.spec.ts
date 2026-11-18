import { expect, test } from "@playwright/test";
import { createUser, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", password: "doimatkhau", role: "OWNER", name: "Chủ shop" });
});

test("chưa đăng nhập bị chuyển về trang đăng nhập kèm next", async ({ page }) => {
  await page.goto("/admin/kho");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fkho$/);
});

test("sai mật khẩu hiện thông báo chung", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Số điện thoại").fill("0900000000");
  await page.getByLabel("Mật khẩu").fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "không đúng" })).toHaveText(
    "Số điện thoại hoặc mật khẩu không đúng",
  );
});

test("đăng nhập bằng +84 rồi quay về trang đã yêu cầu, cookie HttpOnly", async ({ page, context }) => {
  await page.goto("/admin/kho");
  await page.getByLabel("Số điện thoại").fill("+84 900 000 000");
  await page.getByLabel("Mật khẩu").fill("doimatkhau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin\/kho$/);
  const session = (await context.cookies()).find((c) => c.name === "session");
  expect(session?.httpOnly).toBe(true);
});

test("next độc hại bị bỏ qua", async ({ page }) => {
  await page.goto("/admin/login?next=//evil.com");
  await page.getByLabel("Số điện thoại").fill("0900000000");
  await page.getByLabel("Mật khẩu").fill("doimatkhau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/localhost:3100\/admin$/);
});
