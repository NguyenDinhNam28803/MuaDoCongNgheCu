import { expect, test } from "@playwright/test";
import { clearShopCache, createUser, login, resetDb, testDb } from "./helpers";

const IMEI = "490154203237518";
const photo = (n: number) => `devices/2026/11/${String(n).padStart(24, "0")}.webp`;
let iphoneId: string;
let soldId: string;

async function listedDevice(variantId: string, over: Record<string, unknown> = {}) {
  const inspector = await testDb.user.findFirstOrThrow();
  return testDb.device.create({
    data: {
      variantId,
      imei: String(Math.floor(Math.random() * 1e15)).padStart(15, "1"),
      condition: "USED",
      grade: "B",
      batteryPct: 87,
      costPrice: 5_123_000n,
      listPrice: 9_000_000n,
      status: "LISTED",
      listedAt: new Date(),
      regionCode: "VN/A",
      inspections: {
        create: {
          inspectorId: inspector.id,
          templateVersion: 1,
          checklist: [
            { key: "power", label: "Lên nguồn, khởi động bình thường", result: "ok" },
            { key: "speaker_mic", label: "Loa trong, loa ngoài, micro", result: "issue", note: "Loa ngoài hơi rè" },
          ],
          photoKeys: [photo(1), photo(2), photo(3), photo(4)],
          replacedParts: ["Pin"],
          accountLocked: false,
          dataWiped: true,
          passed: true,
        },
      },
      ...over,
    },
  });
}

test.beforeEach(async ({ page }) => {
  await resetDb();
  await createUser({ phone: "0900000000", role: "OWNER", name: "Chủ shop" });
  const product = (name: string, category: "PHONE" | "LAPTOP", storage: string) =>
    testDb.product.create({
      data: { slug: name.toLowerCase().replace(/\s+/g, "-"), name, brand: "Apple", category, variants: { create: { sku: name, storage } } },
      include: { variants: true },
    });
  const iphone = await product("iPhone 13", "PHONE", "128GB");
  const macbook = await product("MacBook Air M2", "LAPTOP", "256GB");
  iphoneId = (await listedDevice(iphone.variants[0].id, { imei: IMEI })).id;
  await listedDevice(macbook.variants[0].id, { listPrice: 15_000_000n });
  soldId = (await listedDevice(iphone.variants[0].id, { status: "SOLD" })).id;
  await testDb.device.create({
    data: { variantId: iphone.variants[0].id, imei: "356938035643809", condition: "USED", costPrice: 1n, status: "INSPECTING" },
  });
  await clearShopCache(page);
});

test("trang chủ hiện máy đang bán, không hiện máy chưa kiểm định/đã bán", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Máy cũ minh bạch như máy mới" })).toBeVisible();
  await expect(page.getByText("Xem tất cả (2)")).toBeVisible();
  const latest = page.locator("section", { has: page.getByRole("heading", { name: "Mới lên kệ" }) });
  await expect(latest.getByRole("link", { name: /iPhone 13/ })).toHaveCount(1);
});

test("lọc laptop và tìm 'dien thoai' không dấu", async ({ page }) => {
  await page.goto("/may?category=LAPTOP");
  await expect(page.getByRole("link", { name: /MacBook Air M2/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /iPhone 13/ })).toHaveCount(0);

  await page.goto("/");
  await page.getByLabel("Tìm sản phẩm").fill("dien thoai");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await expect(page).toHaveURL(/\/may\?q=dien\+thoai/);
  await expect(page.getByRole("link", { name: /iPhone 13/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /MacBook/ })).toHaveCount(0);

  await page.goto("/may?min=abc&max=10tr");
  // min sai bị bỏ qua; max 10tr loại MacBook 15tr.
  await expect(page.getByText("1 máy", { exact: true })).toBeVisible();
});

test("trang máy hiện hộ chiếu, không lộ giá vốn hay IMEI", async ({ page }) => {
  await page.goto("/may");
  await page.getByRole("link", { name: /iPhone 13/ }).click();
  await expect(page).toHaveURL(new RegExp(`/may/iphone-13-128gb-${iphoneId}$`));
  const passport = page.getByRole("region", { name: "Hộ chiếu thiết bị" });
  await expect(passport).toContainText("Hạng B");
  await expect(passport).toContainText("87%");
  await expect(passport).toContainText("Pin");
  await expect(passport).toContainText("Loa ngoài hơi rè");
  await expect(passport).toContainText("Đã qua sử dụng, nguyên trạng");
  await expect(page.getByText("9.000.000 ₫").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /Ảnh thật/ })).toHaveCount(4);

  const html = await page.content();
  expect(html).not.toContain("5123000");
  expect(html).not.toContain("5.123.000");
  expect(html).not.toContain(IMEI);
  expect(html).toContain('"@type":"Product"');
});

test("slug sai chuyển về đúng URL; máy đã bán hiện thông báo", async ({ page }) => {
  await page.goto(`/may/ten-sai-${iphoneId}`);
  await expect(page).toHaveURL(new RegExp(`/may/iphone-13-128gb-${iphoneId}$`));

  await page.goto(`/may/iphone-13-128gb-${soldId}`);
  await expect(page.getByRole("heading", { name: "Máy đã bán" })).toBeVisible();
  await expect(page.getByRole("link", { name: /iPhone 13/ })).toBeVisible();

  await page.goto("/may/khong-ton-tai-abc");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
});

test("sitemap có URL máy đang bán, robots chặn /admin", async ({ page }) => {
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/may/iphone-13-128gb-${iphoneId}`);
  expect(sitemap).not.toContain(soldId);
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});

test("chủ đổi thông tin cửa hàng → website cập nhật ngay", async ({ page }) => {
  await login(page, "0900000000");
  await page.goto("/admin/cai-dat");
  await page.getByLabel("Tên cửa hàng").fill("Táo Xanh Store");
  await page.getByLabel("Số điện thoại").fill("0912 345 678");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(page.getByText("Đã lưu — website cập nhật ngay.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Táo Xanh Store" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("0912345678");
});
