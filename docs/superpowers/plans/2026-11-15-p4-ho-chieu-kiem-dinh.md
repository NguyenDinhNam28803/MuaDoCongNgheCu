# P4 — Hộ chiếu thiết bị / kiểm định: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên/chủ kiểm định một máy trên điện thoại trong vài phút: checklist chạm-chọn 10–15 mục theo loại máy, % pin, linh kiện đã thay, mã vùng, hạng A/B/C, 4–6 ảnh, bước bắt buộc "không khóa tài khoản" + "đã xóa dữ liệu", rồi quyết định Lên kệ (kèm giá bán) / Cần tân trang / Loại bỏ. Báo cáo bất biến, là "hộ chiếu" khách xem ở P5.

**Architecture:** Mẫu checklist là hằng số có phiên bản trong `src/server/inspection/templates.ts` (theo `ProductCategory`). `submitInspection` kiểm tra input thuần, rồi trong một giao dịch: tạo `InspectionReport` + cập nhật thông số máy + `transitionInTx` (cổng kiểm định đã có sẵn). Tân trang xong ghi `DeviceCost(REFURBISH)` + chuyển `REFURBISHING → LISTED`. Đổi giá sau khi lên kệ cần quyền `device.editPrice`. Mọi thay đổi ảnh hưởng website gọi `updateTag("devices")`.

**Tech Stack:** như P1–P3.

**Spec:** `docs/superpowers/specs/2026-11-14-tong-hop-du-an-mvp.md` (P4) + báo cáo (Hộ chiếu thiết bị, Phân hạng A/B/C, quy tắc cứng hóa, báo cáo bất biến).

**Khảo sát (15/11/2026):** có cửa hàng vật lý; không ngách — điện thoại, laptop, máy tính bảng, đồng hồ, phụ kiện.

## Global Constraints

- Như P1–P3 (hàm `src/server/**` nhận `db`; mỗi segment admin có `loading.tsx`; sau migrate chạy `pnpm db:generate`).
- Máy `USED`: 4–6 ảnh bắt buộc; máy `NEW`: 1–6 ảnh. Hạng bắt buộc với `USED`, `null` với `NEW`.
- Lên kệ bắt buộc giá bán > 0, `accountLocked = false`, `dataWiped = true`, mọi mục checklist có kết quả.
- Loại bỏ (`REJECTED`) bắt buộc ghi lý do; khóa tài khoản ⇒ chỉ được chọn Loại bỏ.
- Giá bán lần đầu đặt khi kiểm định (`device.inspect`); đổi giá máy đang bán cần `device.editPrice` (chỉ Chủ).
- `InspectionReport` không bao giờ sửa; kiểm định lại tạo bản mới.

## Review Focus

1. **Máy khóa iCloud nhưng chọn "Lên kệ"** → bị chặn, máy giữ trạng thái. → test Task 2.
2. **Bấm gửi hai lần / hai người kiểm định cùng máy** → chỉ một báo cáo được ghi. → test Task 2 (compare-and-set qua `transitionInTx`).
3. **Thiếu ảnh / ảnh key giả / ảnh chưa tải xong** → chặn. → test Task 2.
4. **Máy trả về (RETURNED)** → phải kiểm định lại mới lên kệ. → test Task 2.
5. **Nhân viên đổi giá máy đang bán** → bị chặn. → test Task 3.

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `src/server/inspection/templates.ts` | Mẫu checklist theo loại, `TEMPLATE_VERSION`, `GRADE_CRITERIA`, `REPLACEABLE_PARTS` |
| `src/server/inspection/service.ts` | `startInspection`, `submitInspection`, `finishRefurbish`, `updateListPrice`, `getLatestReport` |
| `src/server/inspection/errors.ts` | `InspectionRuleError` |
| `src/app/admin/(protected)/kho/[deviceId]/kiem-dinh/**` | Màn hình kiểm định |
| `src/app/admin/(protected)/kho/[deviceId]/*` (sửa) | Nút Bắt đầu kiểm định / Tân trang xong / Đổi giá; hiện báo cáo mới nhất |

### Task 1: Mẫu checklist

**Interfaces — Produces:**
- `TEMPLATE_VERSION = 1`
- `type ChecklistItem = { key: string; label: string }`
- `checklistFor(category: ProductCategory): ChecklistItem[]` — PHONE/TABLET 14 mục, LAPTOP 14 mục, WATCH 10 mục, ACCESSORY/OTHER 6 mục chung
- `type ChecklistResult = { key: string; label: string; result: "ok" | "issue" | "na"; note?: string }`
- `GRADE_CRITERIA: Record<Grade, string>`; `REPLACEABLE_PARTS: Record<"PHONE" | "LAPTOP" | "OTHER", string[]>` + `partsFor(category)`

- [ ] Test: key duy nhất trong mỗi mẫu; PHONE có `face_id`, `true_tone`, `camera_rear`; LAPTOP có `keyboard`, `trackpad`, `battery_cycles`; mọi mẫu 6–15 mục.
- [ ] Cài đặt, chạy `pnpm test` → PASS.

### Task 2: Dịch vụ kiểm định

**Interfaces — Produces:**
- `startInspection(db, actor, deviceId): Promise<void>` — `INTAKE|RETURNED → INSPECTING`
- `type InspectionDecision = "LIST" | "REFURBISH" | "REJECT"`
- `type InspectionInput = { checklist: ChecklistResult[]; batteryPct: number | null; grade: Grade | null; replacedParts: string[]; regionCode: string | null; photoKeys: string[]; accountLocked: boolean; dataWiped: boolean; isRefurbished: boolean; notes: string | null; decision: InspectionDecision; listPrice: bigint | null }`
- `submitInspection(db, actor, deviceId, input, deps?: { objectExists?; now? }): Promise<{ reportId: string; status: DeviceStatus }>`
- `getLatestReport(db, deviceId): Promise<PublicReport | null>` — `PublicReport = { id, createdAt, templateVersion, checklist, batteryPct, grade, replacedParts, photoKeys, isRefurbished... }` (không có người kiểm định nội bộ)

- [ ] Test DB (`service.db.test.ts`):
  - LIST hợp lệ (USED, 4 ảnh, hạng A, pin 88, giá 9tr) → báo cáo `passed=true`, máy `LISTED`, `grade/batteryPct/listPrice/regionCode/isRefurbished` cập nhật, 1 event.
  - `accountLocked=true` + LIST → `"Máy còn khóa tài khoản: chỉ có thể loại bỏ"`; trạng thái vẫn INSPECTING, không có báo cáo.
  - `dataWiped=false` + LIST → `"Phải xóa dữ liệu máy trước khi lên kệ"`.
  - USED 3 ảnh → `"Máy đã qua sử dụng cần 4–6 ảnh"`; 7 ảnh → cùng lỗi; key sai loại → `"Ảnh không hợp lệ"`; `objectExists → false` → `"Có ảnh chưa tải lên xong, vui lòng chụp lại"`.
  - USED thiếu hạng → `"Chọn hạng máy"`; pin 101 → `"% pin không hợp lệ"`.
  - Thiếu mục checklist / key lạ → `"Checklist chưa đủ"`.
  - LIST thiếu giá → `"Nhập giá bán"`.
  - REJECT không ghi chú → `"Ghi lý do loại bỏ"`; REJECT hợp lệ (kể cả khóa tài khoản) → `REJECTED`, `passed=false`.
  - REFURBISH → `REFURBISHING`, `passed=true`.
  - Máy không ở INSPECTING → `DeviceConflictError`; hai lần submit đồng thời → đúng một thành công, đúng một báo cáo.
  - `startInspection` từ RETURNED → INSPECTING; từ LISTED → `InvalidTransitionError`/`DeviceConflictError`.
- [ ] Cài đặt; validate thuần trước, `objectExists` sau, rồi `$transaction`: tạo báo cáo → `transitionInTx(..., data: {...})` (cổng kiểm định đọc báo cáo vừa tạo trong cùng giao dịch).
- [ ] `pnpm test:db` → PASS.

### Task 3: Tân trang xong & đổi giá

**Interfaces — Produces:**
- `finishRefurbish(db, actor, deviceId, { cost: bigint; note: string | null; listPrice: bigint; batteryPct?: number | null; replacedParts?: string[] }): Promise<void>` — ghi `DeviceCost(REFURBISH)` (nếu cost > 0), cập nhật `isRefurbished=true`, chuyển `REFURBISHING → LISTED`
- `updateListPrice(db, actor, deviceId, price: bigint): Promise<void>` — `assertCan(actor.role, "device.editPrice")`, chỉ khi `LISTED`/`RESERVED`, ghi `DeviceEvent` (toStatus = trạng thái hiện tại, reason "Đổi giá: a → b")

- [ ] Test DB: refurbish ghi cost + LISTED + isRefurbished; STAFF `updateListPrice` → `ForbiddenError`; OWNER đổi giá → listPrice mới + event; giá ≤ 0 → `"Giá bán không hợp lệ"`; máy SOLD → `"Chỉ đổi giá máy đang bán"`.
- [ ] Cài đặt → `pnpm test:db` PASS.

### Task 4: Màn hình

- `/admin/kho/[deviceId]`: nút "Bắt đầu kiểm định" (INTAKE/RETURNED), "Kiểm định" (INSPECTING) → `/admin/kho/[id]/kiem-dinh`; khối "Tân trang xong" (REFURBISHING); "Đổi giá" (OWNER, LISTED/RESERVED); khối "Báo cáo kiểm định mới nhất" (checklist, ảnh).
- `/admin/kho/[deviceId]/kiem-dinh`: checklist mỗi mục 3 nút chạm (Đạt / Lỗi / Không áp dụng, mặc định chưa chọn), ô ghi chú khi Lỗi; % pin; chip linh kiện đã thay; mã vùng; hạng A/B/C kèm tiêu chí; 2 câu bắt buộc Có/Không; `PhotoCapture kind="device"` nhiều ảnh (tối đa 6); ghi chú; quyết định + giá bán.
- Server actions gọi service, bắt lỗi nghiệp vụ → `{ error }`, `revalidatePath` + `updateTag("devices")`.
- [ ] E2E `e2e/inspection.spec.ts`: nhân viên kiểm định máy USED đầy đủ → LISTED, thấy báo cáo; khóa tài khoản → nút "Lên kệ" bị vô hiệu, chọn Loại bỏ được; chủ đổi giá; tân trang xong → Đang bán.
- [ ] `pnpm test && pnpm test:db && pnpm test:e2e && pnpm typecheck && pnpm lint && pnpm build` → sạch.
