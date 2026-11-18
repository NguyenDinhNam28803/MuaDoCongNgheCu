# P1 — Xác thực & khung quản trị: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ shop và nhân viên đăng nhập bằng SĐT + mật khẩu trên điện thoại, thấy khung quản trị theo đúng quyền; chủ shop quản lý được tài khoản nhân viên.

**Architecture:** Phiên lưu trong DB (bảng `Session`; cookie `session` chứa token ngẫu nhiên, DB chỉ lưu SHA-256 của token). Logic thuần trong `src/server/auth/*` và `src/server/users/*` (nhận `db`, không import Next). Phần dính Next trong `src/lib/auth/*` (`server-only`, `cookies()`, `redirect`) và `src/proxy.ts` (chỉ kiểm tra lạc quan có cookie). Giao diện bằng Server Components + Server Actions + shadcn/ui.

**Tech Stack:** Next.js 16.4 (App Router, `proxy.ts`), React 19 `useActionState`, Prisma 7.10.1, zod 4, Vitest 5, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-14-tong-hop-du-an-mvp.md` (mục 4 P1, mục 5) + báo cáo phân tích ý tưởng (vai trò Chủ/Nhân viên).

**Thư mục làm việc:** mọi lệnh chạy trong `client/`. Postgres phải đang chạy (`pnpm db:up`).

**Git:** chủ dự án tự khởi tạo repo. Nếu repo chưa có khi thực hiện, bỏ qua các bước Commit.

## Global Constraints

- Không import `next/*`, `react`, `server-only` trong `src/server/**`. Hàm nhận `db: Db` (từ `src/server/db.ts`) làm tham số đầu.
- Mọi file trong `src/lib/auth/**` bắt đầu bằng `import "server-only";`.
- Tên cookie: `session`; `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure: process.env.NODE_ENV === "production"`.
- Phiên sống 30 ngày, trượt: còn dưới 15 ngày thì gia hạn về 30 ngày.
- Khóa đăng nhập: ≥ 5 lần sai trong 15 phút cho cùng một SĐT → từ chối, kể cả khi mật khẩu đúng.
- Thông báo lỗi đăng nhập luôn là `"Số điện thoại hoặc mật khẩu không đúng"` (không tiết lộ SĐT có tồn tại hay không); khi bị khóa: `"Đăng nhập sai quá nhiều lần, thử lại sau 15 phút"`.
- Mật khẩu tối thiểu 8 ký tự.
- SĐT lưu dạng chuẩn hóa `0xxxxxxxxx` (10 chữ số).
- Đọc tài liệu Next 16 trong `node_modules/next/dist/docs/` trước khi viết code Next (AGENTS.md). Liên quan: `01-app/02-guides/authentication.md`, `01-app/03-api-reference/03-file-conventions/proxy.md`, `01-app/02-guides/forms.md`.
- Giao diện viết tiếng Việt, ưu tiên màn hình điện thoại (≥ 360px).

## Review Focus

1. **SĐT nhập nhiều kiểu** (`+84 900 000 000`, `0900.000.000`, `84900000000`): phải đăng nhập được vào tài khoản seed `0900000000`. → test ở Task 2.
2. **Nhân viên bị khóa khi đang đăng nhập**: lần tải trang kế tiếp phải bị đẩy ra trang đăng nhập. → test ở Task 1 (`validateSession` trả `null` khi `active = false`) và Task 7 (`deactivateUser` thu hồi mọi phiên).
3. **Cookie hết hạn / bị sửa / phiên đã xóa**: chuyển về trang đăng nhập, không lỗi 500. → test ở Task 1.
4. **Tham số `next` độc hại** (`//evil.com`, `https://evil.com`, `/admin/../x`): chỉ chấp nhận đường dẫn bắt đầu bằng `/admin`. → test ở Task 4.
5. **Chủ shop tự khóa chính mình**: bị chặn, nếu không shop có thể mất quyền quản trị. → test ở Task 7.

---

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `prisma/schema.prisma` (sửa) | Thêm `Session`, `LoginAttempt` |
| `src/server/auth/session.ts` | Tạo / xác thực / thu hồi phiên |
| `src/server/auth/phone.ts` | Chuẩn hóa SĐT |
| `src/server/auth/login.ts` | `authenticate` + khóa khi sai nhiều |
| `src/server/auth/permissions.ts` | `Permission`, `can`, `assertCan`, `ForbiddenError` |
| `src/server/users/service.ts` | Tạo nhân viên, khóa/mở, đổi mật khẩu |
| `src/lib/auth/session-cookie.ts` | Đọc/ghi/xóa cookie `session` |
| `src/lib/auth/dal.ts` | `getCurrentUser`, `requireUser`, `requirePermission` |
| `src/lib/auth/safe-next.ts` | Lọc tham số `next` |
| `src/lib/admin-nav.ts` | Danh sách mục điều hướng theo quyền |
| `src/proxy.ts` | Chặn lạc quan `/admin/**` khi thiếu cookie |
| `src/app/admin/login/{page.tsx,login-form.tsx,actions.ts}` | Trang đăng nhập |
| `src/app/admin/(protected)/layout.tsx` + `admin-nav.tsx` | Khung quản trị |
| `src/app/admin/(protected)/page.tsx` | Trang chủ quản trị |
| `src/app/admin/(protected)/nhan-vien/{page.tsx,actions.ts}` | Quản lý nhân viên |
| `scripts/reset-password.ts` | CLI đặt lại mật khẩu khi chủ shop quên |

---

### Task 1: Phiên đăng nhập lưu DB

**Files:**
- Modify: `prisma/schema.prisma` (thêm model, thêm quan hệ `sessions Session[]` vào `User`)
- Create: `src/server/auth/session.ts`
- Test: `src/server/auth/session.db.test.ts`

**Interfaces:**
- Produces:
  - `type SessionUser = { id: string; name: string; phone: string; role: Role }`
  - `SESSION_TTL_DAYS = 30`, `SESSION_RENEW_BELOW_DAYS = 15`
  - `createSession(db: Db, userId: string, now?: Date): Promise<{ token: string; expiresAt: Date }>`
  - `validateSession(db: Db, token: string, now?: Date): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null>`
  - `revokeSession(db: Db, token: string): Promise<void>`
  - `revokeAllSessions(db: Db, userId: string): Promise<void>`

- [ ] **Step 1: Thêm model và tạo migration**

```prisma
model Session {
  id         String   @id // SHA-256 hex của token
  userId     String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

Run: `pnpm exec prisma migrate dev --name add_session`
Expected: migration mới trong `prisma/migrations/`, "Your database is now in sync".

- [ ] **Step 2: Viết test thất bại** — `session.db.test.ts`, dọn bảng `session`, `user` trong `beforeEach` (theo mẫu `src/server/devices/service.db.test.ts`):
  - `createSession` trả token base64url dài ≥ 43 ký tự; bản ghi DB có `id === sha256Hex(token)` và **không** chứa token gốc.
  - `validateSession` với token đúng trả `user.role === "OWNER"`, `renewed === false` khi vừa tạo.
  - `now` = tạo + 31 ngày → trả `null` **và** bản ghi bị xóa.
  - `now` = tạo + 20 ngày → `renewed === true`, `expiresAt` = now + 30 ngày.
  - Token ngẫu nhiên không tồn tại → `null`; chuỗi rỗng → `null`.
  - User `active = false` → `null`.
  - `revokeAllSessions` xóa mọi phiên của user đó, không đụng phiên user khác.

- [ ] **Step 3: Chạy để thấy thất bại**

Run: `pnpm test:db -- src/server/auth/session.db.test.ts`
Expected: FAIL (không import được `./session`).

- [ ] **Step 4: Cài đặt `session.ts`** — token = `randomBytes(32).toString("base64url")`, id = `createHash("sha256").update(token).digest("hex")`; gia hạn bằng `update` khi còn < 15 ngày.

- [ ] **Step 5: Chạy lại** — `pnpm test:db` → PASS toàn bộ (cả test cũ).

- [ ] **Step 6: Commit** — `git add prisma src/server/auth/session*.ts && git commit -m "feat(auth): DB-backed sessions"`

---

### Task 2: Chuẩn hóa SĐT, đăng nhập và khóa khi sai nhiều

**Files:**
- Modify: `prisma/schema.prisma` (thêm `LoginAttempt`)
- Create: `src/server/auth/phone.ts`, `src/server/auth/login.ts`
- Test: `src/server/auth/phone.test.ts`, `src/server/auth/login.db.test.ts`

**Interfaces:**
- Consumes: `verifyPassword` (`src/server/auth/password.ts`), `SessionUser` (Task 1)
- Produces:
  - `normalizePhone(input: string): string | null`
  - `LOGIN_MAX_FAILURES = 5`, `LOGIN_WINDOW_MINUTES = 15`
  - `type LoginResult = { ok: true; user: SessionUser } | { ok: false; reason: "invalid" | "locked" }`
  - `authenticate(db: Db, phoneInput: string, password: string, now?: Date): Promise<LoginResult>`

- [ ] **Step 1: Model + migration**

```prisma
model LoginAttempt {
  id        String   @id @default(cuid())
  phone     String
  success   Boolean
  createdAt DateTime @default(now())
  @@index([phone, createdAt])
}
```

Run: `pnpm exec prisma migrate dev --name add_login_attempt`

- [ ] **Step 2: Test thất bại cho `normalizePhone`** (`phone.test.ts`, `it.each`):
  `"0900000000"→"0900000000"`, `"090 000 0000"→"0900000000"`, `"0900.000.000"→"0900000000"`, `"+84 900 000 000"→"0900000000"`, `"84900000000"→"0900000000"`, `"900000000"→null`, `"abc"→null`, `"012345678901"→null`.

- [ ] **Step 3: Test thất bại cho `authenticate`** (`login.db.test.ts`, user seed bằng `hashPassword("doimatkhau")`, phone `0900000000`):
  - Đúng mật khẩu với input `"+84 900 000 000"` → `ok: true`, `user.phone === "0900000000"`.
  - Sai mật khẩu → `{ ok: false, reason: "invalid" }`; SĐT không tồn tại → cũng `"invalid"`.
  - 5 lần sai trong 15 phút rồi đúng mật khẩu → `"locked"`.
  - 5 lần sai, `now` + 16 phút, đúng mật khẩu → `ok: true`.
  - User `active = false`, đúng mật khẩu → `"invalid"`.
  - Mỗi lần gọi ghi đúng một `LoginAttempt` với `success` tương ứng.

- [ ] **Step 4: Chạy để thấy thất bại** — `pnpm test -- phone` và `pnpm test:db -- login` → FAIL.

- [ ] **Step 5: Cài đặt** `phone.ts` (bỏ ký tự không phải số; tiền tố `84` → `0`; hợp lệ khi khớp `/^0\d{9}$/`) và `login.ts` (đếm `LoginAttempt` thất bại trong cửa sổ trước khi kiểm tra mật khẩu; SĐT không chuẩn hóa được → `"invalid"` và không ghi attempt).

- [ ] **Step 6: Chạy lại** — `pnpm test && pnpm test:db` → PASS.

- [ ] **Step 7: Commit** — `git commit -m "feat(auth): phone login with lockout"`

---

### Task 3: Phân quyền & mục điều hướng theo vai trò

**Files:**
- Create: `src/server/auth/permissions.ts`, `src/lib/admin-nav.ts`
- Test: `src/server/auth/permissions.test.ts`, `src/lib/admin-nav.test.ts`

**Interfaces:**
- Produces:
  - `type Permission = "device.intake" | "device.inspect" | "order.sell" | "device.viewCost" | "device.editPrice" | "acquisition.viewSeller" | "report.viewProfit" | "catalog.manage" | "user.manage"`
  - `can(role: Role, permission: Permission): boolean`
  - `assertCan(role: Role, permission: Permission): void` — ném `ForbiddenError`
  - `class ForbiddenError extends Error`
  - `type NavItem = { href: string; label: string; permission?: Permission }`
  - `ADMIN_NAV: NavItem[]`, `navItemsFor(role: Role): NavItem[]`

- [ ] **Step 1: Test thất bại**
  - OWNER: `can` trả `true` với mọi `Permission`.
  - STAFF: `true` đúng với `device.intake`, `device.inspect`, `order.sell`; `false` với 6 quyền còn lại.
  - `assertCan("STAFF", "user.manage")` ném `ForbiddenError`.
  - `navItemsFor("STAFF").map(i => i.href)` = `["/admin", "/admin/kho", "/admin/nhap-may", "/admin/ban-hang", "/admin/don-hang"]`.
  - `navItemsFor("OWNER")` có thêm `"/admin/bao-cao"` (`report.viewProfit`), `"/admin/catalog"` (`catalog.manage`), `"/admin/nhan-vien"` (`user.manage`), theo thứ tự trên nằm sau các mục chung.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test` → FAIL.

- [ ] **Step 3: Cài đặt** — bảng `STAFF_PERMISSIONS: ReadonlySet<Permission>`; OWNER luôn `true`. Nhãn: Tổng quan, Kho, Nhập máy, Bán hàng, Đơn hàng, Báo cáo, Catalog, Nhân viên.

- [ ] **Step 4: Chạy lại** — `pnpm test` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(auth): role permissions and admin nav"`

---

### Task 4: Kết nối Next — cookie, DAL, proxy

**Files:**
- Create: `src/lib/auth/session-cookie.ts`, `src/lib/auth/dal.ts`, `src/lib/auth/safe-next.ts`, `src/proxy.ts`
- Test: `src/lib/auth/safe-next.test.ts`, `src/proxy.test.ts`
- Modify: `package.json` (thêm dependency `server-only`)

**Interfaces:**
- Consumes: `validateSession`, `createSession`, `revokeSession` (Task 1); `can`, `Permission` (Task 3); `prisma` (`src/server/db.ts`)
- Produces:
  - `SESSION_COOKIE = "session"`
  - `setSessionCookie(token: string, expiresAt: Date): Promise<void>`, `readSessionCookie(): Promise<string | undefined>`, `clearSessionCookie(): Promise<void>`
  - `getCurrentUser: () => Promise<SessionUser | null>` (bọc `React.cache`; nếu `renewed` thì gọi `setSessionCookie` trong try/catch vì Server Component không ghi cookie được)
  - `requireUser(): Promise<SessionUser>` — thiếu phiên → `redirect("/admin/login")`
  - `requirePermission(p: Permission): Promise<SessionUser>` — không đủ quyền → `notFound()`
  - `safeNextPath(input: string | null | undefined): string` — mặc định `"/admin"`
  - `proxy(request: NextRequest): NextResponse | undefined`; `config = { matcher: ["/admin/:path*"] }`

- [ ] **Step 1: Cài `server-only`** — `pnpm add server-only`

- [ ] **Step 2: Test thất bại cho `safeNextPath`** (`it.each`): `"/admin/kho"→"/admin/kho"`, `"/admin"→"/admin"`, `null→"/admin"`, `"//evil.com"→"/admin"`, `"https://evil.com"→"/admin"`, `"/adminx"→"/admin"`, `"/admin/../api"→"/admin"`, `"/\\evil.com"→"/admin"`.

- [ ] **Step 3: Test thất bại cho `proxy`** (tạo `new NextRequest("http://localhost/admin/kho")`):
  - Không cookie, path `/admin/kho` → response redirect 307 tới `/admin/login?next=%2Fadmin%2Fkho`.
  - Không cookie, path `/admin/login` → `undefined` (cho đi tiếp).
  - Có cookie `session=x`, path `/admin/kho` → `undefined`.

- [ ] **Step 4: Chạy để thấy thất bại** — `pnpm test` → FAIL.

- [ ] **Step 5: Cài đặt** 4 file. `safeNextPath`: chỉ chấp nhận khi khớp `/^\/admin(\/[A-Za-z0-9\-_/]*)?$/` và không chứa `..`. `proxy` không gọi DB.

- [ ] **Step 6: Chạy lại** — `pnpm test && pnpm typecheck && pnpm lint` → PASS, không lỗi.

- [ ] **Step 7: Commit** — `git commit -m "feat(auth): session cookie, DAL and proxy guard"`

---

### Task 5: Trang đăng nhập & đăng xuất

**Files:**
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/login/login-form.tsx` (`"use client"`), `src/app/admin/login/actions.ts` (`"use server"`)
- Thêm component shadcn: `pnpm dlx shadcn@latest add input label card`

**Interfaces:**
- Consumes: `authenticate` (Task 2), `createSession`/`revokeSession` (Task 1), cookie helpers + `safeNextPath` + `getCurrentUser` (Task 4)
- Produces:
  - `type LoginState = { error?: string }`
  - `loginAction(prev: LoginState, formData: FormData): Promise<LoginState>` — field `phone`, `password`, `next`
  - `logoutAction(): Promise<void>` — thu hồi phiên, xóa cookie, `redirect("/admin/login")`

- [ ] **Step 1: Cài đặt** — zod schema `{ phone: z.string().min(1), password: z.string().min(1), next: z.string().optional() }`; thành công → `createSession` → `setSessionCookie` → `redirect(safeNextPath(next))`. `page.tsx`: đã đăng nhập thì `redirect("/admin")`; đọc `searchParams.next` (Promise trong Next 16) đưa vào hidden input. Form dùng `useActionState`, input `type="tel"` `inputMode="tel"` `autoComplete="username"`, password `autoComplete="current-password"`, nút bị vô hiệu khi đang gửi. Thông báo lỗi đúng chuỗi trong Global Constraints.

- [ ] **Step 2: Kiểm tra thủ công** — `pnpm dev`, mở `http://localhost:3000/admin/kho` ở chế độ thiết bị di động (360px):
  - Bị đưa về `/admin/login?next=%2Fadmin%2Fkho`.
  - Sai mật khẩu → thấy "Số điện thoại hoặc mật khẩu không đúng".
  - Đăng nhập `+84 900 000 000` / `doimatkhau` → về `/admin/kho` (404 tạm thời là đúng, trang chưa có). DevTools thấy cookie `session` có cờ HttpOnly.

- [ ] **Step 3: Kiểm tra** — `pnpm typecheck && pnpm lint && pnpm build` → thành công.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): login and logout"`

---

### Task 6: Khung quản trị mobile-first

**Files:**
- Create: `src/app/admin/(protected)/layout.tsx`, `src/app/admin/(protected)/admin-nav.tsx` (`"use client"`, tô sáng mục đang mở bằng `usePathname`), `src/app/admin/(protected)/page.tsx`
- Thêm component shadcn: `pnpm dlx shadcn@latest add sheet`

**Interfaces:**
- Consumes: `requireUser` (Task 4), `navItemsFor` (Task 3), `logoutAction` (Task 5)
- Produces: route group `(protected)` — mọi trang quản trị sau này đặt trong đây, tự có kiểm tra đăng nhập.

- [ ] **Step 1: Cài đặt** — `layout.tsx` gọi `requireUser()`, truyền `navItemsFor(user.role)` vào `admin-nav`. Điện thoại (< 768px): thanh điều hướng đáy, tối đa 4 mục đầu + nút "Thêm" mở `Sheet` chứa phần còn lại và nút Đăng xuất. Màn rộng: sidebar trái đủ mục. Header: tên shop + tên người dùng. `page.tsx`: "Xin chào, {name}" + vai trò hiển thị "Chủ cửa hàng"/"Nhân viên". Đặt `metadata.robots = { index: false }` ở layout.

- [ ] **Step 2: Kiểm tra thủ công**:
  - Đăng nhập bằng OWNER ở 360px: thanh đáy hiện 4 mục + "Thêm"; trong "Thêm" có Báo cáo, Catalog, Nhân viên, Đăng xuất.
  - Tạo nhanh 1 STAFF bằng Prisma Studio (`pnpm db:studio`, `passwordHash` lấy từ `node -e` gọi `hashPassword`) hoặc đợi Task 7; đăng nhập STAFF: **không** thấy Báo cáo/Catalog/Nhân viên.
  - Đăng xuất → về trang đăng nhập; nút Back không mở lại được trang quản trị.

- [ ] **Step 3: Kiểm tra** — `pnpm typecheck && pnpm lint && pnpm build` → thành công.

- [ ] **Step 4: Commit** — `git commit -m "feat(admin): mobile-first admin shell"`

---

### Task 7: Quản lý nhân viên & đặt lại mật khẩu

**Files:**
- Create: `src/server/users/service.ts`, `src/app/admin/(protected)/nhan-vien/page.tsx`, `src/app/admin/(protected)/nhan-vien/actions.ts`, `scripts/reset-password.ts`
- Test: `src/server/users/service.db.test.ts`
- Modify: `package.json` (script `"user:reset-password": "tsx scripts/reset-password.ts"`)

**Interfaces:**
- Consumes: `hashPassword`, `normalizePhone`, `revokeAllSessions`, `assertCan`, `ForbiddenError`, `requirePermission("user.manage")`
- Produces:
  - `class UserRuleError extends Error` (thông điệp tiếng Việt hiển thị thẳng cho người dùng)
  - `listUsers(db: Db): Promise<Array<SessionUser & { active: boolean; createdAt: Date }>>`
  - `createStaff(db: Db, input: { name: string; phone: string; password: string }): Promise<SessionUser>`
  - `setUserActive(db: Db, actorId: string, userId: string, active: boolean): Promise<void>`
  - `changePassword(db: Db, userId: string, newPassword: string): Promise<void>` — thu hồi mọi phiên của user đó

- [ ] **Step 1: Test thất bại** (`service.db.test.ts`):
  - `createStaff` với phone `"090 111 2222"` lưu `"0901112222"`, role `STAFF`, mật khẩu đã băm (`verifyPassword` đúng).
  - Trùng SĐT → `UserRuleError("Số điện thoại đã được dùng")`; SĐT sai → `UserRuleError("Số điện thoại không hợp lệ")`; mật khẩu 7 ký tự → `UserRuleError("Mật khẩu tối thiểu 8 ký tự")`.
  - `setUserActive(db, staffId → false)` xóa mọi `Session` của nhân viên đó (sau đó `validateSession` trả `null`).
  - Chủ tự khóa mình (`actorId === userId`, `active=false`) → `UserRuleError("Không thể tự khóa tài khoản của mình")`. (Chỉ chủ đang hoạt động mới gọi được hàm này và không tự khóa được, nên luôn còn ít nhất một chủ hoạt động.)
  - `changePassword` → phiên cũ bị thu hồi; mật khẩu mới đăng nhập được qua `authenticate`.

- [ ] **Step 2: Chạy để thấy thất bại** — `pnpm test:db -- users` → FAIL.

- [ ] **Step 3: Cài đặt `service.ts`** — khóa + thu hồi phiên trong cùng `$transaction`.

- [ ] **Step 4: Chạy lại** — `pnpm test:db` → PASS.

- [ ] **Step 5: Trang `/admin/nhan-vien`** — `requirePermission("user.manage")`; danh sách (tên, SĐT, vai trò, trạng thái), form thêm nhân viên, nút Khóa/Mở, form đổi mật khẩu. Server action bắt `UserRuleError` trả `{ error }`, rồi `revalidatePath("/admin/nhan-vien")`.

- [ ] **Step 6: `scripts/reset-password.ts`** — `pnpm user:reset-password <sđt> <mật-khẩu-mới>`: chuẩn hóa SĐT, gọi `changePassword`, in `"Đã đặt lại mật khẩu cho <tên>"`; SĐT không tồn tại → in lỗi, exit code 1.

- [ ] **Step 7: Kiểm tra thủ công** — OWNER thêm nhân viên → đăng nhập nhân viên ở trình duyệt ẩn danh → OWNER khóa nhân viên → trình duyệt ẩn danh tải lại bị đưa về trang đăng nhập. STAFF mở thẳng `/admin/nhan-vien` → 404. Chạy `pnpm user:reset-password 0900000000 matkhaumoi1` → đăng nhập được bằng mật khẩu mới.

- [ ] **Step 8: Kiểm tra cuối** — `pnpm test && pnpm test:db && pnpm typecheck && pnpm lint && pnpm build` → tất cả thành công.

- [ ] **Step 9: Commit** — `git commit -m "feat(admin): staff management and password reset"`

---

## Hoàn thành P1 khi

- Mọi lệnh ở Task 7 Step 8 thành công.
- 5 mục Review Focus đều có test xanh.
- Cập nhật `client/README.md`: mục "Đăng nhập & phân quyền" (2 vai trò, lệnh đặt lại mật khẩu).
