import { expect, test } from "@playwright/test";
import { createUser, resetDb } from "./helpers";

// Máy chậm: người dùng bấm trước khi JS tải xong → form phải vẫn hoạt động.
test.use({ javaScriptEnabled: false });

test("đăng nhập không cần JavaScript, vẫn giữ next", async ({ page }) => {
  await resetDb();
  await createUser({ phone: "0900000000", password: "doimatkhau" });
  await page.goto("/admin/login?next=%2Fadmin%2Fkho");
  await page.getByLabel("Số điện thoại").fill("0900000000");
  await page.getByLabel("Mật khẩu").fill("doimatkhau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin\/kho$/);
});
