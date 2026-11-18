# P3 — Nhập máy, kho theo serial & lưu ảnh: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ shop hoặc nhân viên nhập một máy trong vài phút trên điện thoại: quét IMEI bằng camera, chọn model, nhập giá thu, ghi thông tin người bán kèm ảnh giấy tờ (khi thu từ khách lẻ). Máy vào kho ở trạng thái Tiếp nhận; danh sách kho lọc theo trạng thái, nhân viên không thấy giá vốn.

**Architecture:** Lưu ảnh qua object storage S3-compatible (MinIO khi dev, Cloudflare R2 khi chạy thật): trình duyệt nén ảnh rồi `PUT` thẳng lên presigned URL; server chỉ cấp URL và kiểm tra key khi lưu. Ảnh giấy tờ nằm ở bucket riêng tư, chỉ xem qua URL ký 5 phút. Nhập máy là một giao dịch: tạo `Acquisition` + các `Device` (INTAKE) + `DeviceEvent`. Máy đã bán quay lại thì dùng lại bản ghi `Device` cũ (giữ lịch sử) qua chuyển `SOLD → INTAKE`. Ẩn giá vốn và thông tin người bán làm ở tầng server (DTO không chứa trường đó), không chỉ ẩn trên giao diện.

**Tech Stack:** Next.js 16.4, Prisma 7.10.1, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `browser-image-compression`, `@zxing/browser`, MinIO (Docker), Vitest 5, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-14-tong-hop-du-an-mvp.md` (P3, mục 5 "Ảnh") + báo cáo (Kho theo serial; quy tắc cứng hóa: định danh người bán, cam kết nguồn gốc, lịch sử IMEI; ảnh giấy tờ để riêng, URL ký tạm; Nhân viên không thấy giá vốn).

**Phụ thuộc:** P1 (quyền, khung), P2 (`searchVariants`, `formatVnd`, `parseVndInput`, `MoneyInput`).

## Global Constraints

- Như P1/P2: `src/server/**` không import Next; hàm nhận `db: Db` đầu tiên; lệnh chạy trong `client/`.
- Ảnh chấp nhận: `image/jpeg`, `image/png`, `image/webp`; client nén về WebP, cạnh dài ≤ 1600px, chất lượng 0.8, mục tiêu ≤ 500KB; server từ chối khai báo > 2MB.
- Presigned URL tải lên hết hạn sau 300 giây; URL xem ảnh riêng tư hết hạn sau 300 giây.
- Key ảnh: `id-docs/YYYY/MM/<cuid>.webp` (bucket riêng tư), `devices/YYYY/MM/<cuid>.webp` (bucket công khai, P4 dùng). Server chỉ nhận key đúng tiền tố của loại ảnh và đã tồn tại trên storage.
- Biến môi trường mới (thêm vào `.env.example`): `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`.
- **Thu từ khách lẻ (`TRADE_IN`) bắt buộc:** họ tên, SĐT hợp lệ, ảnh giấy tờ, người bán cam kết nguồn gốc **và** đồng ý cho lưu thông tin (Luật BVDLCN). Nhập buôn chỉ cần tên nguồn.
- IMEI: 15 chữ số, đúng Luhn. Mỗi máy phải có IMEI hoặc serial (laptop: serial 8–20 ký tự chữ-số, viết hoa).
- STAFF không bao giờ nhận `costPrice`, `totalPrice`, thông tin người bán hay URL giấy tờ trong dữ liệu gửi xuống trình duyệt.

## Review Focus

1. **Chuỗi quét được có rác** (`IMEI: 35 209900 176148 1`, hai IMEI của máy 2 SIM trên một dòng, `IMEI1/IMEI2`): lấy IMEI hợp lệ đầu tiên. → test ở Task 2.
2. **Máy đã bán nay thu lại**: dùng lại bản ghi cũ, giữ lịch sử, giá vốn mới; máy đang trong kho thì báo trùng; máy từng bị loại (khóa tài khoản) thì chặn. → test ở Task 4.
3. **Nhân viên xem kho**: HTML/props không chứa giá vốn, tên/SĐT người bán. → test ở Task 5 (DTO không có khóa đó) + kiểm tra thủ công ở Task 8.
4. **Ảnh không tải lên được / gửi key giả** (mạng rớt giữa chừng, sửa form gửi key của người khác hoặc sai tiền tố): không lưu phiếu nhập, báo lỗi rõ. → test ở Task 4.
5. **Từ chối quyền camera / trình duyệt không quét được**: vẫn gõ IMEI tay được, có kiểm tra Luhn. → kiểm tra thủ công ở Task 7.

---

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `../docker-compose.yml` (sửa) | Thêm `minio` + `minio-init` tạo 2 bucket |
| `prisma/schema.prisma` (sửa) | `Acquisition.sellerConsent`, `Acquisition.sourceName` |
| `src/server/storage/config.ts` | Đọc env storage |
| `src/server/storage/keys.ts` | Sinh/kiểm tra key ảnh (thuần) |
| `src/server/storage/s3.ts` | Presign upload/view, kiểm tra tồn tại |
| `src/lib/device-id.ts` | Chuẩn hóa IMEI/serial, Luhn, tách IMEI từ chuỗi quét |
| `src/server/devices/service.ts` (sửa) | `transitionInTx` dùng trong giao dịch bên ngoài |
| `src/server/devices/state-machine.ts` (sửa) | Thêm `SOLD → INTAKE` |
| `src/server/inventory/intake.ts` | `checkIdentifier`, `intakeDevices` |
| `src/server/inventory/queries.ts` | `listDevices`, `getDeviceDetail` có ẩn trường theo quyền |
| `src/app/admin/(protected)/upload-actions.ts` | Server Action cấp URL tải lên |
| `src/components/photo-capture.tsx` | Chụp/chọn ảnh → nén → tải lên → trả key |
| `src/components/imei-scanner.tsx` | Quét mã vạch bằng camera, có ô gõ tay |
| `src/app/admin/(protected)/nhap-may/**` | Luồng nhập máy nhiều bước |
| `src/app/admin/(protected)/kho/**` | Danh sách kho, chi tiết máy |

---

### Task 1: Hạ tầng lưu ảnh

**Files:**
- Modify: `../docker-compose.yml`, `.env`, `.env.example`
- Create: `src/server/storage/config.ts`, `src/server/storage/keys.ts`, `src/server/storage/s3.ts`
- Test: `src/server/storage/keys.test.ts`, `src/server/storage/s3.test.ts`

**Interfaces:**
- Produces:
  - `type PhotoKind = "id-doc" | "device"`
  - `ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const`, `MAX_UPLOAD_BYTES = 2 * 1024 * 1024`
  - `buildPhotoKey(kind: PhotoKind, now?: Date): string`
  - `isKeyOfKind(key: string, kind: PhotoKind): boolean`
  - `bucketFor(kind: PhotoKind, cfg: StorageConfig): string`
  - `getStorageConfig(env?: NodeJS.ProcessEnv): StorageConfig`
  - `createUploadUrl(kind: PhotoKind, contentType: string, size: number, now?: Date): Promise<{ key: string; url: string }>` — ném `StorageError` khi sai loại/quá cỡ
  - `createViewUrl(kind: "id-doc", key: string): Promise<string>`
  - `publicUrl(key: string): string` — cho ảnh `device`
  - `objectExists(kind: PhotoKind, key: string): Promise<boolean>`
  - `class StorageError extends Error`

- [ ] **Step 1: MinIO trong compose** — service `minio` (`minio/minio`, ghim tag cụ thể khi cài, `server /data --console-address :9001`, cổng `9000:9000`, `9001:9001`, user/pass `muaban`/`muaban-secret`, volume `minio-data`) và `minio-init` (`minio/mc`, chạy một lần: tạo bucket `muaban-public` cho phép đọc ẩn danh, `muaban-private` riêng tư; cấu hình CORS cho `http://localhost:3000` với `PUT`). Thêm biến S3 vào `.env`/`.env.example` (`S3_ENDPOINT=http://localhost:9000`, `S3_FORCE_PATH_STYLE=true`, `S3_PUBLIC_BASE_URL=http://localhost:9000/muaban-public`).
  Run: `pnpm db:up` → cả `muaban-db` và `minio` healthy; mở `http://localhost:9001` thấy 2 bucket.

- [ ] **Step 2: Test thất bại**
  - `keys.test.ts`: `buildPhotoKey("id-doc", new Date("2026-11-14T00:00:00Z"))` khớp `/^id-docs\/2026\/11\/[a-z0-9]+\.webp$/`; `isKeyOfKind("id-docs/2026/11/abc.webp", "device") === false`; `isKeyOfKind("id-docs/../devices/x.webp", "id-doc") === false`.
  - `s3.test.ts` (không cần mạng; presign tính cục bộ; `beforeAll` gán các biến `S3_*` giả vào `process.env` vì project `unit` không nạp `.env`): `createUploadUrl("device", "image/webp", 300_000)` trả `url` chứa `muaban-public`, `X-Amz-Expires=300`, và đúng `key`; `contentType = "image/gif"` → `StorageError("Định dạng ảnh không hỗ trợ")`; `size = 3_000_000` → `StorageError("Ảnh quá lớn")`.

- [ ] **Step 3: Chạy để thấy thất bại** — `pnpm test -- storage` → FAIL.

- [ ] **Step 4: Cài đặt** — `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`. `S3Client` tạo một lần từ config; presign `PutObjectCommand` với `ContentType` và `ContentLength`; `objectExists` dùng `HeadObjectCommand` (404 → `false`). `keys.ts` dùng `cuid` từ `@paralleldrive/cuid2` hoặc `randomBytes(12).toString("hex")` (chọn cái sau, không thêm thư viện).

- [ ] **Step 5: Chạy lại** — `pnpm test` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(storage): S3-compatible photo storage with presigned uploads"`

---

### Task 2: IMEI và serial

**Files:**
- Create: `src/lib/device-id.ts`
- Test: `src/lib/device-id.test.ts`

**Interfaces:**
- Produces:
  - `isValidImei(imei: string): boolean` — 15 số + Luhn
  - `normalizeImei(input: string): string | null`
  - `extractImei(scanned: string): string | null` — IMEI hợp lệ đầu tiên trong chuỗi
  - `normalizeSerial(input: string): string | null` — viết hoa, bỏ khoảng trắng/gạch, 8–20 ký tự `[A-Z0-9]`

- [ ] **Step 1: Test thất bại** (`it.each`):
  - `isValidImei("490154203237518") === true`, `isValidImei("490154203237519") === false`, `isValidImei("49015420323751") === false`.
  - `normalizeImei("49 015420 323751 8") === "490154203237518"`, `normalizeImei("4901-5420-3237-518") === "490154203237518"`, `normalizeImei("490154203237519") === null`.
  - `extractImei("IMEI: 49 015420 323751 8")`, `extractImei("490154203237518/356938035643809")`, `extractImei("IMEI1 490154203237518 IMEI2 356938035643809")` đều `=== "490154203237518"`; `extractImei("hello") === null`.
  - `normalizeSerial(" c02xg1-abjg5h ") === "C02XG1ABJG5H"`, `normalizeSerial("abc") === null`.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test -- device-id` → FAIL.

- [ ] **Step 3: Cài đặt** — `extractImei`: tìm các cụm 15 chữ số sau khi gộp khoảng trắng/gạch giữa các nhóm số (regex `/\d[\d\s-]{13,}\d/g`, bỏ ký tự không phải số trong từng cụm, nếu dài 30 thì xét hai nửa), trả cụm đầu tiên qua Luhn.

- [ ] **Step 4: Chạy lại** — `pnpm test` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(lib): IMEI and serial normalization"`

---

### Task 3: Chuyển trạng thái trong giao dịch & thu lại máy đã bán

**Files:**
- Modify: `src/server/devices/state-machine.ts`, `src/server/devices/service.ts`
- Test: `src/server/devices/state-machine.test.ts`, `src/server/devices/service.db.test.ts`

**Interfaces:**
- Produces:
  - `DEVICE_TRANSITIONS.SOLD = ["RETURNED", "INTAKE"]` (`INTAKE` = shop mua lại máy từng bán)
  - `type Tx = Prisma.TransactionClient`
  - `transitionInTx(tx: Tx, input: TransitionInput & { data?: Prisma.DeviceUpdateManyMutationInput }): Promise<void>` — `data` được gộp vào lệnh cập nhật có điều kiện (đổi giá vốn, acquisition… cùng lúc)
  - `transition(db, input)` giữ nguyên chữ ký, bọc `transitionInTx` trong `db.$transaction`

- [ ] **Step 1: Test thất bại**
  - `state-machine.test.ts`: `canTransition("SOLD", "INTAKE") === true`; `canTransition("REJECTED", "INTAKE") === false`.
  - `service.db.test.ts`: trong `db.$transaction(tx => transitionInTx(tx, { from: "SOLD", to: "INTAKE", data: { costPrice: 9_000_000n, grade: null } }))` → máy về `INTAKE`, `costPrice = 9_000_000n`, `version` tăng 1, có thêm 1 `DeviceEvent`.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test && pnpm test:db` → FAIL ở test mới.

- [ ] **Step 3: Cài đặt** — tách thân `transition` hiện tại thành `transitionInTx`; giữ toàn bộ test cũ xanh. Cập nhật chú thích bảng chuyển.

- [ ] **Step 4: Chạy lại** — `pnpm test && pnpm test:db` → PASS (gồm 7 test DB cũ).

- [ ] **Step 5: Commit** — `git commit -m "refactor(devices): transactional transition and SOLD→INTAKE buyback"`

---

### Task 4: Dịch vụ nhập máy

**Files:**
- Modify: `prisma/schema.prisma` — `Acquisition.sellerConsent Boolean @default(false)`, `Acquisition.sourceName String?` (tên nguồn buôn / nhà phân phối)
- Create: `src/server/inventory/errors.ts`, `src/server/inventory/intake.ts`
- Test: `src/server/inventory/intake.db.test.ts`

**Interfaces:**
- Consumes: `normalizeImei`, `normalizeSerial` (Task 2); `isKeyOfKind`, `objectExists` (Task 1); `transitionInTx` (Task 3); `normalizePhone` (P1); `SessionUser` (P1)
- Produces:
  - `class IntakeRuleError extends Error`
  - `type IdentifierCheck = { status: "new" } | { status: "buyback"; deviceId: string; recentAcquisitions: number } | { status: "in-stock"; deviceId: string } | { status: "blocked"; deviceId: string }`
  - `IMEI_RECENT_WINDOW_DAYS = 90`, `IMEI_RECENT_WARN_COUNT = 2`
  - `checkIdentifier(db, id: { imei?: string; serial?: string }, now?: Date): Promise<IdentifierCheck>` — `in-stock` khi trạng thái khác `SOLD`/`REJECTED`; `blocked` khi `REJECTED`
  - `type IntakeDeviceInput = { variantId: string; imei?: string; serial?: string; condition: "NEW" | "USED"; costPrice: bigint; regionCode?: string }`
  - `type IntakeInput = { type: AcquisitionType; seller?: { name: string; phone: string; idDocKey: string; originPledged: boolean; consent: boolean }; sourceName?: string; note?: string; devices: IntakeDeviceInput[] }`
  - `intakeDevices(db, actor: SessionUser, input: IntakeInput, deps?: { objectExists: typeof objectExists }): Promise<{ acquisitionId: string; deviceIds: string[]; warnings: string[] }>` — `deps` để test không cần MinIO

- [ ] **Step 1: Migration** — `pnpm exec prisma migrate dev --name intake_fields`

- [ ] **Step 2: Test thất bại** (`objectExists` giả trả `true` trừ khi test nói khác):
  - `TRADE_IN` hợp lệ, 1 máy → tạo `Acquisition` (`totalPrice` = tổng giá thu, `sellerPhone` chuẩn hóa), `Device` `INTAKE` `USED`, 1 `DeviceEvent` (`fromStatus: null`, `toStatus: "INTAKE"`, `actorId` = actor).
  - `TRADE_IN` thiếu `consent` → `IntakeRuleError("Người bán phải đồng ý cho lưu thông tin")`; thiếu `originPledged` → `"Người bán phải cam kết nguồn gốc máy"`; SĐT sai → `"Số điện thoại người bán không hợp lệ"`; `idDocKey = "devices/2026/11/x.webp"` → `"Ảnh giấy tờ không hợp lệ"`; `objectExists → false` → `"Ảnh giấy tờ chưa tải lên xong, vui lòng chụp lại"`.
  - Máy không có IMEI lẫn serial → `"Máy thứ 1: cần IMEI hoặc serial"`; IMEI sai Luhn → `"Máy thứ 1: IMEI không hợp lệ"`; hai máy cùng IMEI trong một phiếu → `"IMEI bị lặp trong phiếu"`.
  - `NEW_STOCK` với `condition: "USED"` → `"Hàng nhập từ nhà phân phối phải là máy mới"`.
  - Biến thể `isSerialized = false` hoặc `archived` → `"Máy thứ 1: model không hợp lệ"`.
  - IMEI đang ở `LISTED` → `"Máy thứ 1: IMEI đang có trong kho"`; ở `REJECTED` → `"Máy thứ 1: máy này từng bị loại (khóa tài khoản/không đạt), không nhận"`.
  - IMEI ở `SOLD` → dùng lại `deviceId` cũ, trạng thái `INTAKE`, `acquisitionId` mới, `costPrice` mới, `grade`/`batteryPct`/`listPrice` = `null`, lịch sử sự kiện cũ còn nguyên.
  - Máy đã có 2 lần nhập trong 90 ngày, nhập lần 3 → thành công nhưng `warnings` chứa `"IMEI 490154203237518 đã được nhập 2 lần trong 90 ngày, cần xem xét nguồn gốc"`.
  - Lỗi ở máy thứ 2 → không có gì được ghi (giao dịch rollback).

- [ ] **Step 3: Chạy để thấy thất bại** — `pnpm test:db -- intake` → FAIL.

- [ ] **Step 4: Cài đặt** — kiểm tra toàn bộ input trước (không I/O), rồi `objectExists`, rồi một `db.$transaction`: tạo `Acquisition`, với từng máy `new` → `device.create` + `deviceEvent.create`; `buyback` → `transitionInTx(tx, { from: "SOLD", to: "INTAKE", data: {...} })`.

- [ ] **Step 5: Chạy lại** — `pnpm test:db` → PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(inventory): device intake with seller identity and IMEI history"`

---

### Task 5: Truy vấn kho có ẩn trường theo quyền

**Files:**
- Create: `src/server/inventory/queries.ts`
- Test: `src/server/inventory/queries.db.test.ts`

**Interfaces:**
- Consumes: `can` (P1), `variantLabel` (P2), `inventoryAgeDays` (`src/server/reports/profit.ts`), `availableForSaleWhere` (`src/server/devices/service.ts`)
- Produces:
  - `type InventoryTab = "processing" | "listed" | "reserved" | "sold" | "rejected"` — `processing` = `INTAKE | INSPECTING | REFURBISHING | RETURNED`; `listed` dùng `availableForSaleWhere`; `reserved` = `RESERVED` còn hạn
  - `type DeviceListItem = { id; imei: string | null; serial: string | null; productName; variantLabel; condition; grade; status; listPrice: bigint | null; ageDays: number; costPrice?: bigint }`
  - `listDevices(db, viewer: SessionUser, filter: { tab: InventoryTab; q?: string; page?: number }, now?: Date): Promise<{ items: DeviceListItem[]; total: number }>` — 50 dòng/trang; `q` khớp đuôi IMEI/serial (≥ 4 số) hoặc tên model; tuổi tồn tính từ `listedAt ?? createdAt`; mới nhất trước
  - `getDeviceDetail(db, viewer, deviceId): Promise<DeviceDetail | null>` — `DeviceDetail` = `DeviceListItem` + `events: { fromStatus; toStatus; actorName: string | null; reason: string | null; createdAt }[]` + `acquisition?: { type; createdAt; sellerName; sellerPhone; sourceName; hasIdDoc: boolean; totalPrice }` (chỉ khi có quyền `acquisition.viewSeller`)
  - `getIdDocViewUrl(db, viewer, deviceId): Promise<string | null>` — `assertCan(viewer.role, "acquisition.viewSeller")` rồi `createViewUrl`

- [ ] **Step 1: Test thất bại**
  - STAFF: mọi phần tử của `listDevices` **không có khóa** `costPrice` (`expect("costPrice" in item).toBe(false)`); `getDeviceDetail` không có khóa `acquisition`; `getIdDocViewUrl` ném `ForbiddenError`.
  - OWNER: có `costPrice` và `acquisition.sellerName`.
  - Tab `listed` gồm máy `RESERVED` đã quá hạn; tab `reserved` không gồm máy đó.
  - `q = "7518"` tìm thấy máy IMEI `490154203237518`; `q = "iphone 13"` tìm theo tên model.
  - `ageDays` = 12 với `listedAt` 12 ngày trước.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test:db -- queries` → FAIL.

- [ ] **Step 3: Cài đặt** — dựng DTO bằng tay (không trả nguyên bản ghi Prisma); `select` không lấy `costPrice` khi không có quyền.

- [ ] **Step 4: Chạy lại** — `pnpm test:db` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(inventory): role-aware inventory queries"`

---

### Task 6: Chụp và tải ảnh từ điện thoại

**Files:**
- Create: `src/app/admin/(protected)/upload-actions.ts` (`"use server"`), `src/components/photo-capture.tsx` (`"use client"`)

**Interfaces:**
- Consumes: `createUploadUrl` (Task 1), `requirePermission("device.intake")` (P1)
- Produces:
  - `requestUploadAction(kind: PhotoKind, contentType: string, size: number): Promise<{ key: string; url: string } | { error: string }>`
  - `<PhotoCapture kind="id-doc" name="idDocKey" label="Ảnh CCCD/giấy tờ" required />` — render `<input type="file" accept="image/*" capture="environment">`, nén bằng `browser-image-compression` (`maxWidthOrHeight: 1600`, `fileType: "image/webp"`, `initialQuality: 0.8`), gọi action, `fetch(url, { method: "PUT", body, headers: { "Content-Type": "image/webp" } })`, hiển thị ảnh xem trước + trạng thái (đang tải/xong/lỗi + nút Thử lại), đặt `key` vào hidden input `name`.

- [ ] **Step 1: Cài đặt** — `pnpm add browser-image-compression`. Khi tải lỗi: hidden input để trống để form không gửi được.

- [ ] **Step 2: Kiểm tra thủ công** — trang thử tạm thời hoặc dùng luôn ở Task 7; trên điện thoại thật (cùng Wi-Fi, `pnpm dev -H 0.0.0.0`, thêm IP máy vào CORS MinIO): chụp ảnh 4–12MB → tải lên < 5 giây, object trong `muaban-private` ≤ 500KB, định dạng WebP. Tắt mạng giữa chừng → hiện lỗi và nút Thử lại.

- [ ] **Step 3: Kiểm tra** — `pnpm typecheck && pnpm lint` → sạch.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): mobile photo capture with client-side compression"`

---

### Task 7: Màn hình nhập máy

**Files:**
- Create: `src/components/imei-scanner.tsx` (`"use client"`), `src/app/admin/(protected)/nhap-may/page.tsx`, `.../nhap-may/intake-form.tsx` (`"use client"`), `.../nhap-may/actions.ts` (`"use server"`)
- Thêm component: `pnpm dlx shadcn@latest add command popover checkbox radio-group alert`

**Interfaces:**
- Consumes: `extractImei`, `normalizeImei`, `normalizeSerial` (Task 2); `checkIdentifier`, `intakeDevices`, `IntakeRuleError` (Task 4); `searchVariants`, `MoneyInput`, `parseVndInput` (P2); `PhotoCapture` (Task 6); `requirePermission("device.intake")` (P1)
- Produces:
  - `<ImeiScanner onDetected={(imei: string) => void} />` — `@zxing/browser` `BrowserMultiFormatReader.decodeFromVideoDevice` với camera sau; qua `extractImei` mới gọi `onDetected`; luôn có ô gõ tay; lỗi quyền camera → ẩn khung camera, hiện "Không mở được camera, hãy nhập IMEI bằng tay".
  - `checkIdentifierAction(imeiOrSerial: string): Promise<IdentifierCheck | { error: string }>`
  - `searchVariantsAction(q: string): Promise<Awaited<ReturnType<typeof searchVariants>>>`
  - `intakeAction(prev: IntakeState, formData: FormData): Promise<IntakeState>` với `IntakeState = { error?: string; warnings?: string[]; done?: { acquisitionId: string; deviceIds: string[] } }`

- [ ] **Step 1: Cài đặt** — `pnpm add @zxing/browser`. Luồng trên một trang, các bước gập/mở:
  1. **Nguồn:** Thu từ khách / Nhập buôn / Nhập máy mới.
  2. **Người bán** (chỉ Thu từ khách): họ tên, SĐT, `PhotoCapture kind="id-doc"`, 2 ô tick "Người bán cam kết máy thuộc sở hữu hợp pháp" và "Người bán đồng ý cho cửa hàng lưu thông tin để đối chiếu nguồn gốc". Nhập buôn: ô "Tên nguồn".
  3. **Máy** (lặp được, nút "+ Thêm máy" cho nhập buôn): quét/gõ IMEI → gọi `checkIdentifierAction` ngay: `in-stock`/`blocked` hiện cảnh báo đỏ và chặn; `buyback` hiện "Máy từng bán ra, sẽ nhập lại với lịch sử cũ"; chọn model bằng ô tìm (`Command`, gõ ≥ 2 ký tự); tình trạng Mới/Đã dùng (mặc định theo nguồn); giá thu bằng `MoneyInput`, bên dưới hiện "Giá tham chiếu: …" của biến thể đã chọn.
  4. **Xác nhận:** tóm tắt, tổng tiền, nút "Nhập kho". Thành công → hiện cảnh báo (nếu có) + nút "Nhập máy khác" / "Xem trong kho".

- [ ] **Step 2: Kiểm tra thủ công** (điện thoại thật, đăng nhập STAFF):
  - Thu từ khách 1 iPhone: quét IMEI từ màn hình `*#06#` của máy khác → điền đúng; cả luồng ≤ 3 phút; máy xuất hiện ở tab "Đang xử lý".
  - Bỏ tick đồng ý → không gửi được, hiện thông báo.
  - Từ chối quyền camera → gõ IMEI tay; IMEI sai một số → báo "IMEI không hợp lệ" trước khi gửi.
  - Nhập buôn 3 máy một phiếu, máy thứ 3 trùng IMEI đang bán → báo lỗi máy thứ 3, kho không có máy nào mới.
  - Gõ IMEI của máy đã bán (tạo bằng Prisma Studio) → thấy thông báo nhập lại.

- [ ] **Step 3: Kiểm tra** — `pnpm typecheck && pnpm lint && pnpm build` → thành công.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): mobile device intake flow with IMEI scanning"`

---

### Task 8: Màn hình kho

**Files:**
- Create: `src/app/admin/(protected)/kho/page.tsx`, `src/app/admin/(protected)/kho/[deviceId]/page.tsx`, `src/app/admin/(protected)/kho/[deviceId]/id-doc-button.tsx` (`"use client"`), `src/app/admin/(protected)/kho/actions.ts`
- Thêm component: `pnpm dlx shadcn@latest add tabs`

**Interfaces:**
- Consumes: `listDevices`, `getDeviceDetail`, `getIdDocViewUrl` (Task 5); `formatVnd` (P2); `requireUser` (P1)
- Produces: `viewIdDocAction(deviceId: string): Promise<{ url: string } | { error: string }>`

- [ ] **Step 1: Cài đặt**
  - `/admin/kho?tab=processing&q=…&page=…`: tab Đang xử lý / Đang bán / Đang giữ / Đã bán / Loại bỏ kèm số lượng; ô tìm "4 số cuối IMEI hoặc tên máy"; thẻ máy: tên + nhãn biến thể, hạng, IMEI rút gọn `…7518`, giá bán, tuổi tồn (đỏ khi > 30 ngày), giá vốn chỉ khi DTO có.
  - `/admin/kho/[deviceId]`: thông tin máy, dòng thời gian sự kiện (tiếng Việt cho từng trạng thái), khối "Nguồn nhập" chỉ khi có `acquisition`, nút "Xem giấy tờ" mở URL ký trong tab mới.

- [ ] **Step 2: Kiểm tra thủ công**
  - OWNER thấy giá vốn và thông tin người bán; bấm "Xem giấy tờ" mở được ảnh; URL đó mở lại sau 5 phút → bị từ chối.
  - STAFF: "Xem nguồn trang" (view-source) và tab Network của trang `/admin/kho` và `/admin/kho/[id]` **không** chứa chuỗi giá vốn đã nhập (vd. `9000000`) hay SĐT người bán.
  - Tìm `7518` ra đúng máy.

- [ ] **Step 3: Kiểm tra cuối** — `pnpm test && pnpm test:db && pnpm typecheck && pnpm lint && pnpm build` → thành công.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): inventory list and device detail"`

---

## Hoàn thành P3 khi

- Lệnh ở Task 8 Step 3 thành công; 5 mục Review Focus đã có test xanh hoặc đã kiểm tra thủ công theo đúng bước.
- `client/README.md` thêm: cách bật MinIO, biến S3, cách cấu hình Cloudflare R2 khi deploy (bucket công khai + bucket riêng tư, CORS cho tên miền thật).
- Sẵn sàng P10a: chủ shop dùng thử luồng nhập máy trên điện thoại thật.
