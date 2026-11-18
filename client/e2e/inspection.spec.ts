import { expect, test, type Page } from "@playwright/test";
import { createUser, login, resetDb, testDb } from "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

let deviceId: string;

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
  await createUser({ phone: "0911111111", role: "STAFF", name: "Nhân viên A" });
  const product = await testDb.product.create({
    data: {
      slug: "iphone-13",
      name: "iPhone 13",
      brand: "Apple",
      category: "PHONE",
      variants: { create: { sku: "IPHONE-13-128GB", storage: "128GB", referencePrice: 7_500_000n } },
      },
    include: { variants: true },
  });
  deviceId = (
    await testDb.device.create({
      data: { variantId: product.variants[0].id, imei: "490154203237518", condition: "USED", costPrice: 7_000_000n, status: "INTAKE" },
    })
  ).id;
});

async function openInspection(page: Page) {
  await page.goto(`/admin/kho/${deviceId}`);
  await page.getByRole("button", { name: "Bắt đầu kiểm định" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/kho/${deviceId}/kiem-dinh$`));
}

async function fillCommon(page: Page, { locked = false } = {}) {
  await page.getByRole("button", { name: "Tất cả đạt" }).click();
  // Ô radio ẩn (sr-only), người dùng bấm vào nhãn.
  await page.getByRole("group", { name: "Loa trong, loa ngoài, micro" }).getByText("Lỗi", { exact: true }).click();
  await page.getByLabel("Ghi chú: Loa trong, loa ngoài, micro").fill("Loa ngoài hơi rè");
  await page.getByLabel("% pin").fill("88");
  await page.getByLabel("Hạng B").check();
  await page.getByLabel("Pin", { exact: true }).check();
  for (let i = 1; i <= 4; i++) {
    await page.getByLabel(`Ảnh ${i}`, { exact: true }).setInputFiles({ name: `${i}.png`, mimeType: "image/png", buffer: PNG });
  }
  await expect(page.getByText("Đã tải ảnh")).toHaveCount(4);
  await page.getByRole("radiogroup", { name: "Máy còn khóa tài khoản (iCloud/Google/MDM)?" }).getByLabel(locked ? "Có" : "Không").check();
  await page.getByRole("radiogroup", { name: "Đã xóa dữ liệu và đăng xuất mọi tài khoản?" }).getByLabel("Có").check();
}

test("nhân viên kiểm định máy cũ và đưa lên kệ", async ({ page }) => {
  await login(page, "0911111111");
  await openInspection(page);
  await fillCommon(page);
  await page.getByLabel("Lên kệ bán").check();
  await page.getByLabel("Giá bán").fill("9,5tr");
  await page.getByRole("button", { name: "Lưu kiểm định" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/kho/${deviceId}$`));
  await expect(page.getByText("Đang bán").first()).toBeVisible();
  const report = page.getByRole("region", { name: "Báo cáo kiểm định" });
  await expect(report).toContainText("Loa ngoài hơi rè");
  await expect(report).toContainText("Hạng B");
  await expect(report.getByRole("img")).toHaveCount(4);
  await expect(page.getByText("9.500.000 ₫").first()).toBeVisible();

  // Lên kệ xong là hiện ngay trên website (action gọi updateTag("devices")).
  await page.goto("/may");
  await expect(page.getByRole("link", { name: /iPhone 13/ })).toBeVisible();
});

test("máy khóa tài khoản: không lên kệ được, chỉ loại bỏ", async ({ page }) => {
  await login(page, "0911111111");
  await openInspection(page);
  await fillCommon(page, { locked: true });
  await expect(page.getByLabel("Lên kệ bán")).toBeDisabled();
  await expect(page.getByLabel("Cần tân trang")).toBeDisabled();
  await page.getByLabel("Loại bỏ").check();
  await page.getByLabel("Ghi chú kiểm định").fill("Khóa iCloud, khách không nhớ mật khẩu");
  await page.getByRole("button", { name: "Lưu kiểm định" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/kho/${deviceId}$`));
  await expect(page.getByText("Loại bỏ").first()).toBeVisible();
});

test("cần tân trang → tân trang xong → đang bán; chủ đổi giá", async ({ page }) => {
  await login(page, "0900000000");
  await openInspection(page);
  await fillCommon(page);
  await page.getByLabel("Cần tân trang").check();
  await page.getByRole("button", { name: "Lưu kiểm định" }).click();
  await expect(page.getByText("Tân trang").first()).toBeVisible();

  const refurb = page.getByRole("region", { name: "Tân trang xong" });
  await refurb.getByLabel("Chi phí tân trang").fill("800k");
  await refurb.getByLabel("% pin sau tân trang").fill("100");
  await refurb.getByLabel("Giá bán").fill("10tr");
  await refurb.getByRole("button", { name: "Lên kệ" }).click();
  await expect(page.getByText("10.000.000 ₫").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Báo cáo kiểm định" })).toContainText("Sau tân trang");

  const price = page.getByRole("region", { name: "Đổi giá bán" });
  await price.getByLabel("Giá bán mới").fill("9,8tr");
  await price.getByRole("button", { name: "Đổi giá" }).click();
  await expect(page.getByText("9.800.000 ₫").first()).toBeVisible();
});

test("nhân viên không thấy ô đổi giá", async ({ page }) => {
  await testDb.device.update({ where: { id: deviceId }, data: { status: "LISTED", listPrice: 9_000_000n } });
  await login(page, "0911111111");
  await page.goto(`/admin/kho/${deviceId}`);
  await expect(page.getByRole("heading", { name: /iPhone 13/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Đổi giá bán" })).toHaveCount(0);
});
