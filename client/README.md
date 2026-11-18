# Muabán đồ công nghệ — client

Web app Next.js full-stack cho cửa hàng 1–2 người bán đồ công nghệ mới + cũ.
Thiết kế theo báo cáo phân tích ý tưởng (12/11/2026).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL 17 (Docker) + Prisma 7 (`prisma-client` generator, adapter `pg`)
- Tailwind CSS 4 + shadcn/ui
- Vitest (test đơn vị + test tích hợp DB)

## Chạy lần đầu

```bash
pnpm install              # tự chạy prisma generate
cp .env.example .env
pnpm db:up                # Postgres localhost:5434 + kho ảnh SeaweedFS localhost:8333
pnpm storage:init         # tạo 2 bucket ảnh + CORS (chạy một lần)
pnpm db:migrate           # áp migration
pnpm db:seed              # model phổ biến + tài khoản chủ shop 0900000000 / doimatkhau
pnpm dev
```

> Cổng 5434 được dùng để tránh đụng Postgres cài sẵn trên máy (5432).

## Kho ảnh

- Dev: SeaweedFS (S3-compatible) trong `docker-compose.yml`; MinIO không còn image công khai. Production: Cloudflare R2.
- Bucket `muaban-public` (ảnh máy, đọc công khai) và `muaban-private` (ảnh giấy tờ người bán, chỉ xem qua URL ký 5 phút, chỉ Chủ cửa hàng).
- Trình duyệt nén ảnh (WebP ≤1600px) rồi PUT thẳng lên presigned URL; server chỉ cấp URL và kiểm tra key.
- R2: tạo 2 bucket, bật public access cho bucket public, đặt biến `S3_*` theo `.env.example`, `S3_CORS_ORIGINS` = domain thật, rồi chạy `pnpm storage:init` để áp CORS.

## Scripts

| Lệnh | Việc |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` | ESLint / `next typegen` + tsc |
| `pnpm test` | Test đơn vị (không cần DB) |
| `pnpm test:db` | Test tích hợp trên DB `muaban_test` |
| `pnpm test:e2e` | Test giao diện bằng Playwright (Chrome cài sẵn, DB `muaban_test`, cổng 3100) |
| `pnpm db:up` / `db:down` | Bật / tắt Postgres |
| `pnpm db:migrate --name <tên>` | Tạo + áp migration khi đổi schema — **sau đó chạy `pnpm db:generate`** (Prisma 7 không tự sinh client) |
| `pnpm db:seed` / `db:studio` | Seed / Prisma Studio |
| `pnpm user:reset-password <sđt> <mật-khẩu>` | Đặt lại mật khẩu (khi chủ shop quên) |

## Đăng nhập & phân quyền

- Trang quản trị: `/admin` (đăng nhập ở `/admin/login` bằng SĐT + mật khẩu; tài khoản seed `0900000000` / `doimatkhau` — đổi ngay sau khi cài).
- Phiên lưu trong bảng `Session` (cookie `session` HttpOnly, 30 ngày, tự gia hạn). Sai mật khẩu 5 lần trong 15 phút → khóa 15 phút.
- Hai vai trò: **Chủ cửa hàng** (mọi quyền) và **Nhân viên** (nhập máy, kiểm định, bán; không thấy giá vốn, thông tin người bán, báo cáo, catalog, nhân viên). Bảng quyền: `src/server/auth/permissions.ts`.
- Khóa nhân viên hoặc đổi mật khẩu → mọi phiên của người đó bị thu hồi ngay.

## Quy ước Next 16 (Cache Components đang bật)

- Trang quản trị đặt trong `src/app/admin/(protected)/`; layout đã kiểm tra đăng nhập.
- **Mỗi thư mục trang quản trị mới cần `loading.tsx`** (`export { default } from "../loading";`) để trang đọc DB/phiên nằm sau Suspense.
- Kiểm tra quyền thật bằng `requireUser()` / `requirePermission()` (`src/lib/auth/dal.ts`); `src/proxy.ts` chỉ chặn sơ bộ khi thiếu cookie.

## Cấu trúc

```
prisma/
  schema.prisma        # thực thể lõi: Product/Variant, Device, InspectionReport, DeviceEvent…
  migrations/
  seed.ts
src/
  app/                 # giao diện (website bán hàng + trang quản trị)
  components/ui/       # shadcn/ui
  generated/prisma/    # Prisma Client (sinh tự động, không commit)
  server/              # logic nghiệp vụ — hàm thuần, KHÔNG phụ thuộc Next.js
    db.ts              # PrismaClient singleton
    devices/           # lõi "Thiết bị + kho": máy trạng thái, transition, giữ máy
    pricing/           # công thức định giá thu
    reports/           # lãi gộp theo máy, tuổi tồn kho
    auth/              # băm mật khẩu (scrypt)
test/                  # global setup cho test tích hợp
```

## Quy tắc nghiệp vụ đã cứng hóa

- **Mỗi máy có IMEI/serial là một `Device`**, kể cả máy mới; phụ kiện dùng `ProductVariant.stockQty`.
- **Giá là BigInt VND**, không dùng số thực.
- **Đổi trạng thái máy chỉ qua `server/devices/service.ts`** (`transition`, `reserveDevice`,
  `releaseExpiredReservations`). Bảng chuyển hợp lệ nằm ở `state-machine.ts`; mỗi lần chuyển ghi
  `DeviceEvent` trong cùng giao dịch.
- **Cổng kiểm định**: lên kệ (`LISTED`/`REFURBISHING`) phải có báo cáo kiểm định mới nhất đạt,
  không khóa tài khoản (iCloud/Google/MDM) và đã xóa dữ liệu. Máy trả về phải kiểm định lại.
- **Chống bán trùng**: compare-and-set ở tầng DB (`updateMany ... where status`), cập nhật 0 dòng
  → `DeviceConflictError`. Hết hạn giữ xử lý "lười": `RESERVED` quá hạn được coi như `LISTED`.
- `InspectionReport` và `DeviceEvent` chỉ ghi thêm; đơn hàng tham chiếu báo cáo tại thời điểm bán.
