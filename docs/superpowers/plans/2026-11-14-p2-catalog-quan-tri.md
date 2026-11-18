# P2 — Catalog quản trị: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ shop thêm/sửa model và biến thể (dung lượng, màu, RAM), cập nhật giá tham chiếu thu và giá máy mới, quản lý tồn phụ kiện trên điện thoại, không phải gõ mã SKU hay slug.

**Architecture:** Logic thuần trong `src/server/catalog/*` (nhận `db`), tiện ích thuần dùng chung server + giao diện trong `src/lib/*` (tiền, slug). Trang quản trị dưới `src/app/admin/(protected)/catalog/**`, ghi bằng Server Actions, kiểm tra input bằng zod. Không xóa cứng: model/biến thể đã có máy hoặc đơn thì chỉ ẩn (`archived`).

**Tech Stack:** Next.js 16.4, Prisma 7.10.1, zod 4, Vitest 5, shadcn/ui (`table`, `select`, `dialog`, `badge`, `switch`).

**Spec:** `docs/superpowers/specs/2026-11-14-tong-hop-du-an-mvp.md` (P2) + báo cáo (Catalog: "nhập nhanh từ danh sách model phổ biến đã chuẩn bị sẵn"; giá tham chiếu nằm ở variant).

**Phụ thuộc:** P1 xong (`requirePermission`, khung `(protected)`, quyền `catalog.manage`).

## Global Constraints

- Như P1: `src/server/**` không import Next; hàm nhận `db: Db` đầu tiên; lệnh chạy trong `client/`.
- Tiền là `bigint` VND. Hiển thị: `formatVnd(15500000n) === "15.500.000 ₫"`.
- Chỉ OWNER (`catalog.manage`) được ghi catalog. STAFF chỉ đọc qua các hàm `list*`/`search*` (P3 dùng khi nhập máy).
- Slug và SKU sinh tự động, duy nhất; người dùng không gõ.
- Không xóa cứng Product/ProductVariant đã được tham chiếu bởi `Device` hoặc `OrderItem`; dùng `archived = true`. Bản ghi `archived` không hiện trong tìm kiếm khi nhập máy.
- Không cho đổi `isSerialized` của biến thể đã có `Device` hoặc `stockQty > 0`.
- Tồn phụ kiện không bao giờ âm.

## Review Focus

1. **Gõ giá kiểu Việt** (`15.500.000`, `15,5tr`, `15tr`, `500k`, `15 500 000`): phải ra đúng số; chuỗi rác phải báo lỗi, không lưu `0`. → test ở Task 1.
2. **Tên có dấu / trùng tên** (`Kính cường lực iPhone`, hai model cùng tên): slug không dấu (`đ` → `d`), không trùng (`-2`). → test ở Task 1 và Task 2.
3. **Ẩn biến thể đã có máy**: không xóa được, ẩn được; máy cũ vẫn hiển thị đúng tên model. → test ở Task 2.
4. **Đổi phụ kiện ↔ máy có serial sau khi đã có hàng**: bị chặn. → test ở Task 2.
5. **Trừ tồn phụ kiện quá số đang có**: bị chặn, tồn giữ nguyên. → test ở Task 3.

---

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` (sửa) | `archived` cho `Product` và `ProductVariant` |
| `src/lib/money.ts` | `parseVndInput`, `formatVnd` (dùng cả client và server) |
| `src/lib/slug.ts` | `slugify` tiếng Việt |
| `src/server/catalog/errors.ts` | `CatalogRuleError` |
| `src/server/catalog/schemas.ts` | zod schema input |
| `src/server/catalog/products.ts` | CRUD model + biến thể, ẩn/hiện, `variantLabel`, `searchVariants` |
| `src/server/catalog/stock.ts` | Điều chỉnh tồn phụ kiện |
| `src/app/admin/(protected)/catalog/page.tsx` | Danh sách + lọc + tìm |
| `src/app/admin/(protected)/catalog/moi/page.tsx` | Thêm model (kèm biến thể đầu tiên) |
| `src/app/admin/(protected)/catalog/[productId]/page.tsx` | Sửa model, bảng biến thể |
| `src/app/admin/(protected)/catalog/actions.ts` | Server Actions |
| `src/components/money-input.tsx` | Ô nhập tiền có xem trước định dạng |

---

### Task 1: Tiện ích tiền và slug

**Files:**
- Create: `src/lib/money.ts`, `src/lib/slug.ts`
- Test: `src/lib/money.test.ts`, `src/lib/slug.test.ts`

**Interfaces:**
- Produces:
  - `parseVndInput(input: string): bigint | null`
  - `formatVnd(amount: bigint | null | undefined): string` — `null`/`undefined` → `"—"`
  - `slugify(input: string): string`

- [ ] **Step 1: Test thất bại** (`it.each`):
  - `parseVndInput`: `"15500000"→15500000n`, `"15.500.000"→15500000n`, `"15 500 000"→15500000n`, `"15tr"→15000000n`, `"15,5tr"→15500000n`, `"15.5 triệu"→15500000n`, `"500k"→500000n`, `"0"→0n`, `""→null`, `"abc"→null`, `"-5"→null`, `"15,5"→null` (không đơn vị mà có phần thập phân là mơ hồ).
  - `formatVnd`: `15500000n→"15.500.000 ₫"`, `0n→"0 ₫"`, `null→"—"`.
  - `slugify`: `"iPhone 15 Pro Max"→"iphone-15-pro-max"`, `"Kính cường lực iPhone"→"kinh-cuong-luc-iphone"`, `"Đồng hồ  Galaxy Watch"→"dong-ho-galaxy-watch"`, `"MacBook Air M2 13\""→"macbook-air-m2-13"`, `"  --  "→""`.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test -- src/lib` → FAIL.

- [ ] **Step 3: Cài đặt** — `parseVndInput`: bỏ khoảng trắng, hạ chữ thường; nếu có hậu tố `tr|triệu|trieu` thì nhân 1.000.000, `k|nghìn|ngàn` thì nhân 1.000, khi có hậu tố cho phép `,` hoặc `.` làm dấu thập phân; không hậu tố thì `.` là phân cách nghìn và chỉ chấp nhận số nguyên. Tính bằng số nguyên (không dùng `parseFloat` × hệ số; tách phần nguyên/phần thập phân). `formatVnd`: `Intl.NumberFormat("vi-VN")` trên chuỗi BigInt + `" ₫"`. `slugify`: `normalize("NFD")`, bỏ dấu kết hợp, `đ/Đ → d`, ký tự không phải `[a-z0-9]` → `-`, gộp và cắt `-` hai đầu.

- [ ] **Step 4: Chạy lại** — `pnpm test` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(lib): VND money parsing and Vietnamese slugify"`

---

### Task 2: Dịch vụ model & biến thể

**Files:**
- Modify: `prisma/schema.prisma` — `archived Boolean @default(false)` ở `Product` và `ProductVariant`
- Create: `src/server/catalog/errors.ts`, `src/server/catalog/schemas.ts`, `src/server/catalog/products.ts`
- Test: `src/server/catalog/products.db.test.ts`, `src/server/catalog/variant-label.test.ts`

**Interfaces:**
- Consumes: `slugify` (Task 1)
- Produces:
  - `class CatalogRuleError extends Error`
  - `productInputSchema` (`name`, `brand`, `category`) và `variantInputSchema` (`storage?`, `ram?`, `color?`, `isSerialized`, `referencePrice: bigint | null`, `newPrice: bigint | null`) — zod
  - `variantLabel(v: { storage?: string | null; ram?: string | null; color?: string | null }): string` — `"8GB/256GB · Titan đen"`; chỉ storage → `"256GB"`; rỗng → `"Mặc định"`
  - `createProduct(db, input: ProductInput & { firstVariant: VariantInput }): Promise<{ productId: string }>`
  - `updateProduct(db, productId, input: ProductInput): Promise<void>` — slug giữ nguyên khi đổi tên (link cũ không gãy)
  - `addVariant(db, productId, input: VariantInput): Promise<{ variantId: string }>`
  - `updateVariant(db, variantId, input: VariantInput): Promise<void>`
  - `setArchived(db, target: { productId: string } | { variantId: string }, archived: boolean): Promise<void>`
  - `deleteVariant(db, variantId): Promise<void>` — chỉ khi chưa có `Device`/`OrderItem`
  - `listProducts(db, filter: { q?: string; category?: ProductCategory; includeArchived?: boolean }): Promise<ProductListItem[]>` — `ProductListItem = { id, slug, name, brand, category, archived, variantCount, listedDeviceCount }`
  - `getProduct(db, productId): Promise<ProductDetail | null>` — kèm biến thể và số máy theo trạng thái
  - `searchVariants(db, q: string, opts?: { serializedOnly?: boolean }): Promise<Array<{ variantId: string; productName: string; label: string; referencePrice: bigint | null }>>` — bỏ `archived`, tối đa 20 kết quả, tìm không dấu theo tên model + nhãn biến thể

- [ ] **Step 1: Migration** — `pnpm exec prisma migrate dev --name catalog_archived`

- [ ] **Step 2: Test thất bại**
  - `variant-label.test.ts`: 3 trường hợp nhãn ở Interfaces.
  - `products.db.test.ts`:
    - `createProduct({ name: "iPhone 15 Pro Max", … firstVariant: { storage: "256GB", color: "Titan đen" } })` → slug `iphone-15-pro-max`, SKU biến thể `IPHONE-15-PRO-MAX-256GB-TITAN-DEN`.
    - Tạo lần hai cùng tên → slug `iphone-15-pro-max-2`; thêm biến thể trùng thuộc tính → SKU có hậu tố `-2`.
    - `updateProduct` đổi tên → slug không đổi.
    - `deleteVariant` trên biến thể có `Device` → `CatalogRuleError("Biến thể đã có máy hoặc đơn hàng, chỉ có thể ẩn")`; `setArchived(..., true)` thì được; `searchVariants` không trả biến thể đó nữa.
    - `updateVariant` đổi `isSerialized` khi đã có `Device` → `CatalogRuleError("Không thể đổi loại quản lý khi đã có hàng")`.
    - `searchVariants(db, "iphone 15 pro")` và `searchVariants(db, "IPHONE15")` tìm thấy; `searchVariants(db, "kinh cuong luc", { serializedOnly: true })` không trả phụ kiện.

- [ ] **Step 3: Chạy để thấy thất bại** — `pnpm test && pnpm test:db` → FAIL ở file mới.

- [ ] **Step 4: Cài đặt** — SKU = `slugify(product.name + " " + storage + " " + ram + " " + color).toUpperCase()`, thêm `-n` khi trùng. `searchVariants`: so khớp `slugify(q)` bỏ `-` với `slugify(tên model + nhãn)` bỏ `-` (đủ cho vài trăm biến thể; P5 mới dùng full-text `unaccent` cho website).

- [ ] **Step 5: Chạy lại** — `pnpm test && pnpm test:db` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(catalog): product and variant service"`

---

### Task 3: Tồn phụ kiện

**Files:**
- Create: `src/server/catalog/stock.ts`
- Test: `src/server/catalog/stock.db.test.ts`

**Interfaces:**
- Produces: `adjustAccessoryStock(db, variantId: string, delta: number): Promise<{ stockQty: number }>`

- [ ] **Step 1: Test thất bại**
  - Phụ kiện tồn 3, `delta = +5` → 8; `delta = -8` → 0.
  - Tồn 2, `delta = -3` → `CatalogRuleError("Không đủ hàng trong kho")`, tồn vẫn 2.
  - Biến thể `isSerialized = true` → `CatalogRuleError("Máy có serial quản lý theo từng máy, không chỉnh số lượng")`.
  - Hai lệnh `-1` chạy đồng thời trên tồn 1 → đúng một thành công, tồn 0.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test:db -- stock` → FAIL.

- [ ] **Step 3: Cài đặt** — một câu `updateMany({ where: { id, isSerialized: false, stockQty: { gte: -delta } }, data: { stockQty: { increment: delta } } })`; `count === 0` thì đọc lại để chọn đúng thông báo lỗi.

- [ ] **Step 4: Chạy lại** — `pnpm test:db` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(catalog): accessory stock adjustment"`

---

### Task 4: Màn hình catalog

**Files:**
- Create: các file `src/app/admin/(protected)/catalog/**` và `src/components/money-input.tsx` trong bảng File Structure
- Thêm component: `pnpm dlx shadcn@latest add table select dialog badge switch`

**Interfaces:**
- Consumes: mọi hàm Task 1–3; `requirePermission("catalog.manage")` (P1)
- Produces: `MoneyInput` — `<MoneyInput name="referencePrice" defaultValue={bigint | null} />`; gửi lên server chuỗi gốc, server parse bằng `parseVndInput`; bên dưới ô hiện bản xem trước `formatVnd` hoặc "Giá không hợp lệ".

- [ ] **Step 1: Cài đặt**
  - `/admin/catalog`: ô tìm + lọc loại (Điện thoại, Laptop, Máy tính bảng, Đồng hồ, Phụ kiện, Khác) + công tắc "Hiện mục đã ẩn"; mỗi dòng: tên, hãng, số biến thể, số máy đang bán; trên điện thoại hiển thị dạng thẻ.
  - `/admin/catalog/moi`: một form gồm model + biến thể đầu tiên; xong chuyển tới trang sửa.
  - `/admin/catalog/[productId]`: sửa thông tin model; danh sách biến thể, mỗi biến thể sửa trong `Dialog` (giá tham chiếu thu, giá máy mới, thuộc tính); phụ kiện có nút `+`/`−` và ô nhập số lượng nhập thêm; nút Ẩn/Hiện; nút Xóa chỉ hiện khi biến thể chưa có hàng.
  - Mọi action: `requirePermission("catalog.manage")`, `safeParse` zod, bắt `CatalogRuleError` → `{ error }`, `revalidatePath`.

- [ ] **Step 2: Kiểm tra thủ công** (360px, đăng nhập OWNER, dữ liệu seed):
  - Thêm model "Kính cường lực Samsung" loại Phụ kiện, giá máy mới `150k` → thấy "150.000 ₫".
  - Sửa giá tham chiếu iPhone 13 128GB thành `7,2tr` → danh sách hiện 7.200.000 ₫.
  - Nhập giá `abc` → thông báo lỗi, không lưu.
  - Ẩn một biến thể → biến mất khỏi danh sách khi tắt "Hiện mục đã ẩn".
  - Đăng nhập STAFF mở `/admin/catalog` → 404.

- [ ] **Step 3: Kiểm tra** — `pnpm test && pnpm test:db && pnpm typecheck && pnpm lint && pnpm build` → thành công.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): catalog management screens"`

---

## Hoàn thành P2 khi

- Lệnh ở Task 4 Step 3 thành công; 5 mục Review Focus có test xanh.
- `searchVariants` sẵn sàng cho P3 (chọn model khi nhập máy).
