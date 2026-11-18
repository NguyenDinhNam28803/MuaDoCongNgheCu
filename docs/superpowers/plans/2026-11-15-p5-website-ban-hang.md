# P5 — Website bán hàng (phía khách): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách xem máy đang bán trên điện thoại: trang chủ, danh sách lọc (loại, mới/cũ, hạng, giá) + tìm không dấu, trang từng máy hiện **hộ chiếu thiết bị** (ảnh thật, checklist, pin, linh kiện thay, hạng + tiêu chí, nguyên trạng/tân trang), nút gọi/Zalo để hỏi mua (đặt hàng online là P6), trang chính sách, SEO.

**Architecture:** Route group `src/app/(shop)/` (layout header/footer riêng, không đụng admin). Dữ liệu công khai từ `src/server/shop/queries.ts` — DTO chỉ chứa trường công khai (không giá vốn, không người bán, không người kiểm định). Hàm đọc bọc `'use cache'` + `cacheTag("devices")` + `cacheLife("minutes")`; mọi action đổi máy (P3 nhập, P4 kiểm định/giá) gọi `updateTag("devices")`. Thông tin shop (tên, SĐT, Zalo, địa chỉ, bảo hành) từ `ShopSetting` + mặc định trong `src/server/shop/settings.ts`.

**Spec:** tổng hợp MVP (P5) + báo cáo (trang máy đủ thông tin để khách không phải hỏi lại; phân biệt tân trang / nguyên trạng; SEO từng trang máy; kênh thật là Facebook/Zalo).

## Global Constraints

- Không bao giờ trả `costPrice`, `acquisition`, `inspectorId`, `sellerIdDocKey` ra trang công khai. Test kiểm tra khóa không tồn tại.
- Chỉ hiển thị máy "còn bán" theo `availableForSaleWhere`; máy đang giữ hiển thị nhãn "Đang có khách giữ" ở trang chi tiết nhưng không ở danh sách.
- URL máy: `/may/<slug>-<deviceId>` (slug từ tên + biến thể, chỉ để đẹp; tra cứu theo id cuối).
- Ghi "Mới" chỉ cho `condition = NEW` (Luật BVQLNTD: không ghi "mới" cho máy đã dùng).
- Giao diện tiếng Việt, mobile-first, ảnh `loading="lazy"`.

## Review Focus

1. **Lộ dữ liệu nội bộ** qua RSC payload → test DTO + E2E kiểm tra HTML không chứa giá vốn / SĐT người bán.
2. **URL máy đã bán / không tồn tại / slug sai** → 404 hoặc chuyển về slug đúng; máy đã bán → trang "Máy đã bán" + gợi ý máy tương tự (không 500).
3. **Tìm có dấu/không dấu** ("điện thoại", "dien thoai", "iphone13") → ra kết quả. → test Task 1.
4. **Lọc giá gõ sai** (`?min=abc`) → bỏ qua, không lỗi.
5. **Cache cũ sau khi lên kệ** → action gọi `updateTag("devices")`; E2E: kiểm định xong → máy hiện trên web.

## Tasks

### Task 1: Truy vấn công khai (`src/server/shop/queries.ts`)
- `listPublicDevices(db, filter: { q?; category?; condition?; grade?; minPrice?; maxPrice?; sort?: "newest" | "price-asc" | "price-desc"; page? }, now?)` → `{ items: PublicDeviceCard[]; total }`, 24/trang
- `PublicDeviceCard = { id; slug; productName; variantLabel; category; condition; grade; isRefurbished; batteryPct; listPrice; coverPhotoUrl: string | null }`
- `getPublicDevice(db, deviceId, now?)` → `PublicDeviceDetail | null` = card + `{ status: "available" | "reserved" | "sold"; regionCode; photos: string[]; report: { createdAt; checklist; replacedParts; templateVersion } | null; brand }` (null nếu chưa từng lên kệ: INTAKE/INSPECTING/REJECTED…)
- `listPublicAccessories(db)` → biến thể `isSerialized=false`, `stockQty>0`, có `newPrice`, không ẩn
- `deviceSlug(productName, variantLabel)`, `parseDeviceParam(param)` → id
- [ ] Test DB: không có khóa nhạy cảm; chỉ máy còn bán; lọc từng tiêu chí; tìm có/không dấu; sắp xếp; trang chi tiết trạng thái reserved/sold; ảnh bìa = ảnh đầu báo cáo mới nhất.

### Task 2: Cấu hình shop (`src/server/shop/settings.ts`)
- `getShopInfo(db)` → `{ name; phone; zalo; address; hours; warrantyUsedDays; warrantyText; returnText }` đọc `ShopSetting` key `shop.info`, gộp mặc định.
- [ ] Test: mặc định khi chưa có; gộp một phần.

### Task 3: Giao diện
- `(shop)/layout.tsx` header (logo chữ, tìm kiếm, link Điện thoại/Laptop/Phụ kiện) + footer (địa chỉ, giờ, SĐT, Zalo, link chính sách).
- `(shop)/page.tsx` trang chủ: lời cam kết minh bạch, danh mục, máy mới lên kệ (8), phụ kiện.
- `(shop)/may/page.tsx` danh sách + bộ lọc (form GET, không cần JS), phân trang.
- `(shop)/may/[slug]/page.tsx` chi tiết: thư viện ảnh, giá, nhãn Mới/Đã dùng/Đã tân trang/Nguyên trạng, hạng + tiêu chí, pin, mã vùng, hộ chiếu (checklist Đạt/Lỗi), linh kiện đã thay, bảo hành, nút "Gọi" / "Nhắn Zalo" kèm nội dung có mã máy; `generateMetadata`, JSON-LD `Product` (offers, itemCondition).
- `(shop)/phu-kien/page.tsx`, `(shop)/chinh-sach/page.tsx` (tiêu chí hạng, bảo hành, đổi trả, quyền riêng tư).
- `src/app/sitemap.ts`, `src/app/robots.ts` (chặn `/admin`).
- Xóa trang mẫu Next ở `src/app/page.tsx`.
- [ ] E2E `e2e/shop.spec.ts`: trang chủ hiện máy đang bán; lọc laptop; tìm "dien thoai"; trang máy hiện hộ chiếu + không lộ giá vốn; máy đã bán hiện "Máy đã bán"; slug sai → về đúng URL; sitemap có URL máy.
- [ ] Kiểm tra cuối như P4.
