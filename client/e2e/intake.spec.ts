import { expect, test, type Page } from "@playwright/test";
import { createUser, login, resetDb, testDb } from "./helpers";

// Ảnh PNG 2x2 hợp lệ để giả lập ảnh chụp CCCD.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);
const IMEI = "490154203237518";

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
  await createUser({ phone: "0911111111", role: "STAFF", name: "Nhân viên A" });
  await testDb.product.create({
    data: {
      slug: "iphone-13",
      name: "iPhone 13",
      brand: "Apple",
      category: "PHONE",
      variants: { create: { sku: "IPHONE-13-128GB", storage: "128GB", referencePrice: 7_500_000n } },
    },
  });
});

async function fillDevice(page: Page, row: number, imei: string, price: string) {
  const device = page.getByRole("group", { name: `Máy thứ ${row}` });
  await device.getByLabel("IMEI hoặc serial").fill(imei);
  await device.getByLabel("IMEI hoặc serial").blur();
  await device.getByLabel("Tìm model").fill("iphone 13");
  await device.getByRole("button", { name: /iPhone 13 · 128GB/ }).click();
  await expect(device.getByText("Giá tham chiếu: 7.500.000 ₫")).toBeVisible();
  await device.getByLabel("Giá nhập").fill(price);
  return device;
}

async function fillSeller(page: Page, { consent = true } = {}) {
  await page.getByLabel("Thu từ khách").check();
  await page.getByLabel("Họ tên người bán").fill("Nguyễn Văn B");
  await page.getByLabel("Số điện thoại người bán").fill("0912 345 678");
  await page.getByLabel("Ảnh CCCD/giấy tờ").setInputFiles({ name: "cccd.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Đã tải ảnh")).toBeVisible();
  await page.getByLabel("Người bán cam kết máy thuộc sở hữu hợp pháp").check();
  if (consent) await page.getByLabel("Người bán đồng ý cho cửa hàng lưu thông tin").check();
}

test("nhân viên thu máy từ khách: ảnh giấy tờ, IMEI, giá — máy vào kho, không lộ giá vốn", async ({ page }) => {
  await login(page, "0911111111");
  await page.goto("/admin/nhap-may");
  await fillSeller(page);
  const device = await fillDevice(page, 1, IMEI, "7tr");
  await expect(device.getByText("Máy mới, chưa có trong hệ thống")).toBeVisible();
  await page.getByRole("button", { name: "Nhập kho" }).click();
  await expect(page.getByText("Đã nhập 1 máy vào kho")).toBeVisible();

  await page.getByRole("link", { name: "Xem trong kho" }).click();
  await expect(page).toHaveURL(/\/admin\/kho\?tab=processing/);
  const card = page.getByRole("listitem").filter({ hasText: "iPhone 13" });
  await expect(card).toContainText("…7518");

  const html = await page.content();
  expect(html).not.toContain("7.000.000");
  expect(html).not.toContain("7000000");
  await card.getByRole("link").click();
  await expect(page.getByRole("heading", { name: /iPhone 13/ })).toBeVisible();
  const detailHtml = await page.content();
  expect(detailHtml).not.toContain("0912345678");
  expect(detailHtml).not.toContain("Nguyễn Văn B");
  expect(detailHtml).not.toContain("7000000");
});

test("chủ thấy giá vốn, người bán và mở được ảnh giấy tờ", async ({ page, context }) => {
  await login(page, "0900000000");
  await page.goto("/admin/nhap-may");
  await fillSeller(page);
  await fillDevice(page, 1, IMEI, "7tr");
  await page.getByRole("button", { name: "Nhập kho" }).click();
  await expect(page.getByText("Đã nhập 1 máy vào kho")).toBeVisible();

  await page.goto("/admin/kho?tab=processing");
  const card = page.getByRole("listitem").filter({ hasText: "iPhone 13" });
  await expect(card).toContainText("Vốn 7.000.000 ₫");
  await card.getByRole("link").click();
  await expect(page.getByText("Nguyễn Văn B")).toBeVisible();
  await expect(page.getByText("0912345678")).toBeVisible();

  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Xem giấy tờ" }).click()]);
  // Tab mở ở about:blank rồi mới được gán URL ký.
  await popup.waitForURL((url) => url.pathname.includes("/id-docs/"));
  expect(popup.url()).toContain("X-Amz-Signature");
});

test("thiếu đồng ý lưu thông tin thì không nhập được", async ({ page }) => {
  await login(page, "0911111111");
  await page.goto("/admin/nhap-may");
  await fillSeller(page, { consent: false });
  await fillDevice(page, 1, IMEI, "7tr");
  await page.getByRole("button", { name: "Nhập kho" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "đồng ý cho lưu thông tin" })).toBeVisible();
  expect(await testDb.device.count()).toBe(0);
});

test("IMEI sai một số báo lỗi ngay trên form", async ({ page }) => {
  await login(page, "0911111111");
  await page.goto("/admin/nhap-may");
  const device = page.getByRole("group", { name: "Máy thứ 1" });
  await device.getByLabel("IMEI hoặc serial").fill("490154203237519");
  await device.getByLabel("IMEI hoặc serial").blur();
  await expect(device.getByText("IMEI không hợp lệ")).toBeVisible();
});

test("nhập buôn 2 máy, máy thứ 2 đang có trong kho → không máy nào được nhập", async ({ page }) => {
  const variant = await testDb.productVariant.findFirstOrThrow();
  await testDb.device.create({
    data: { variantId: variant.id, imei: "356938035643809", condition: "USED", costPrice: 1n, status: "LISTED" },
  });
  await login(page, "0911111111");
  await page.goto("/admin/nhap-may");
  await page.getByLabel("Nhập buôn").check();
  await page.getByLabel("Tên nguồn hàng").fill("Mối buôn Hà Nội");
  await fillDevice(page, 1, IMEI, "6tr");
  await page.getByRole("button", { name: "Thêm máy" }).click();
  const second = page.getByRole("group", { name: "Máy thứ 2" });
  await second.getByLabel("IMEI hoặc serial").fill("356938035643809");
  await second.getByLabel("IMEI hoặc serial").blur();
  await expect(second.getByText("IMEI đang có trong kho")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nhập kho" })).toBeDisabled();
  expect(await testDb.device.count()).toBe(1);
});

test("không mở được camera thì hướng dẫn gõ tay", async ({ page }) => {
  await login(page, "0911111111");
  await page.goto("/admin/nhap-may");
  const device = page.getByRole("group", { name: "Máy thứ 1" });
  await device.getByRole("button", { name: "Quét mã" }).click();
  await expect(device.getByText("Không mở được camera, hãy nhập IMEI bằng tay")).toBeVisible();
});

test("tìm máy trong kho bằng 4 số cuối IMEI", async ({ page }) => {
  const variant = await testDb.productVariant.findFirstOrThrow();
  await testDb.device.create({
    data: { variantId: variant.id, imei: IMEI, condition: "USED", costPrice: 1n, status: "LISTED", listPrice: 9_000_000n },
  });
  await login(page, "0911111111");
  await page.goto("/admin/kho?tab=listed");
  await page.getByLabel("Tìm máy").fill("7518");
  await page.getByRole("button", { name: "Tìm" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "…7518" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "…7518" })).toContainText("9.000.000 ₫");
});
