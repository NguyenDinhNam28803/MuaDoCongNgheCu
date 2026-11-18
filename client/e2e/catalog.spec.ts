import { expect, test, type Page } from "@playwright/test";
import { createUser, login, resetDb } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
});

async function createModel(
  page: Page,
  m: { name: string; brand: string; category: string; storage?: string; color?: string; ref?: string; newPrice?: string; accessory?: boolean },
) {
  await page.goto("/admin/catalog/moi");
  await page.getByLabel("Tên model").fill(m.name);
  await page.getByLabel("Hãng").fill(m.brand);
  await page.getByLabel("Loại").selectOption({ label: m.category });
  if (m.accessory) await page.getByLabel("Phụ kiện (quản lý theo số lượng)").check();
  if (m.storage) await page.getByLabel("Dung lượng").fill(m.storage);
  if (m.color) await page.getByLabel("Màu").fill(m.color);
  if (m.ref) await page.getByLabel("Giá tham chiếu thu").fill(m.ref);
  if (m.newPrice) await page.getByLabel("Giá máy mới / giá bán").fill(m.newPrice);
  await page.getByRole("button", { name: "Tạo model" }).click();
  await expect(page.getByRole("heading", { name: m.name })).toBeVisible();
}

test("thêm phụ kiện với giá gõ tắt 150k và nhập thêm tồn", async ({ page }) => {
  await login(page, "0900000000");
  await createModel(page, { name: "Kính cường lực Samsung", brand: "OEM", category: "Phụ kiện", newPrice: "150k", accessory: true });
  const variant = page.getByRole("listitem").filter({ hasText: "Mặc định" });
  await expect(variant).toContainText("150.000 ₫");
  await expect(variant).toContainText("Tồn: 0");

  await variant.getByLabel("Số lượng nhập thêm").fill("5");
  await variant.getByRole("button", { name: "Nhập thêm" }).click();
  await expect(variant).toContainText("Tồn: 5");
});

test("sửa giá tham chiếu bằng 7,2tr; giá rác báo lỗi và không lưu", async ({ page }) => {
  await login(page, "0900000000");
  await createModel(page, { name: "iPhone 13", brand: "Apple", category: "Điện thoại", storage: "128GB", ref: "7,5tr" });
  const variant = page.getByRole("listitem").filter({ hasText: "128GB" });
  await expect(variant).toContainText("7.500.000 ₫");

  await variant.getByRole("button", { name: "Sửa" }).click();
  await variant.getByLabel("Giá tham chiếu thu").fill("abc");
  await variant.getByRole("button", { name: "Lưu biến thể" }).click();
  await expect(variant.getByRole("alert")).toHaveText("Giá không hợp lệ");

  await variant.getByLabel("Giá tham chiếu thu").fill("7,2tr");
  await variant.getByRole("button", { name: "Lưu biến thể" }).click();
  await expect(variant).toContainText("7.200.000 ₫");

  await page.goto("/admin/catalog");
  await expect(page.getByRole("link", { name: /iPhone 13/ })).toBeVisible();
});

test("ẩn biến thể và lọc mục đã ẩn trong danh sách", async ({ page }) => {
  await login(page, "0900000000");
  await createModel(page, { name: "Galaxy S24", brand: "Samsung", category: "Điện thoại", storage: "256GB", ref: "9tr" });
  await page.getByRole("button", { name: "Ẩn model" }).click();
  await expect(page.getByText("Model đang ẩn")).toBeVisible();

  await page.goto("/admin/catalog");
  await expect(page.getByRole("link", { name: /Galaxy S24/ })).toHaveCount(0);
  await page.getByLabel("Hiện mục đã ẩn").check();
  await page.getByRole("button", { name: "Lọc" }).click();
  await expect(page.getByRole("link", { name: /Galaxy S24/ })).toBeVisible();
});

test("tìm và lọc theo loại", async ({ page }) => {
  await login(page, "0900000000");
  await createModel(page, { name: "MacBook Air M2", brand: "Apple", category: "Laptop", storage: "256GB", ref: "13tr" });
  await createModel(page, { name: "Củ sạc 20W", brand: "OEM", category: "Phụ kiện", newPrice: "250k", accessory: true });

  await page.goto("/admin/catalog?q=macbook");
  await expect(page.getByRole("link", { name: /MacBook Air M2/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Củ sạc/ })).toHaveCount(0);

  await page.goto("/admin/catalog?category=ACCESSORY");
  await expect(page.getByRole("link", { name: /Củ sạc/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /MacBook/ })).toHaveCount(0);
});

test("nhân viên không vào được catalog", async ({ page }) => {
  await createUser({ phone: "0911111111", role: "STAFF" });
  await login(page, "0911111111");
  await page.goto("/admin/catalog");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});
