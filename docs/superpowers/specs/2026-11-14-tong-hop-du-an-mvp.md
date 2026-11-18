# Tổng hợp dự án & lộ trình MVP — Nền tảng quản lý & bán đồ công nghệ (mới + cũ)

Ngày: 14/11/2026 · Nguồn: "Báo cáo phân tích ý tưởng" (12/11/2026) + khung code hiện có trong `client/`.

## 1. Dự án trong một đoạn

Web cho **một cửa hàng nhỏ 1–2 người** vừa quản lý vừa bán đồ công nghệ mới và cũ. Hệ thống thắng hay thua ở
chỗ **tiết kiệm thao tác cho chủ shop** (mọi thao tác chính làm được trên điện thoại trong vài phút), và cạnh tranh
bằng **độ minh bạch của từng chiếc máy cũ** ("hộ chiếu thiết bị"), không bằng giá hay khuyến mãi. Mô hình: tự
doanh mới + cũ, thu cũ tại quầy; thu cũ online ở giai đoạn 2; không làm marketplace.

**Thước đo thành công của MVP** (cổng 2 trong báo cáo): có đơn thật đầu tiên **và kho trên web khớp kho thật**.
**Thất bại dù chạy được:** chủ shop bỏ nhập liệu vì quá nhiều bước; không ai bảo trì sau bàn giao.

## 2. Hiện trạng (đã xong)

| Hạng mục | Trạng thái |
| --- | --- |
| Next.js 16 + TS + Tailwind 4 + shadcn/ui trong `client/` | Xong |
| PostgreSQL 17 (Docker, cổng 5434) + Prisma 7, migration `init`, seed 9 model | Xong |
| Schema lõi: Product/Variant, Device, InspectionReport, DeviceEvent, DeviceCost, Acquisition, Order/OrderItem, Warranty, User, ShopSetting | Xong |
| Máy trạng thái thiết bị + cổng kiểm định + `transition` / `reserveDevice` / `releaseExpiredReservations` (compare-and-set) | Xong, có test DB |
| Công thức định giá thu, lãi gộp theo máy, tuổi tồn kho, băm mật khẩu | Xong, có test |
| Giao diện, đăng nhập, upload ảnh, deploy | **Chưa** |

## 3. Phạm vi MVP (Giai đoạn 1 của báo cáo)

Trong MVP: catalog + biến thể · kho theo serial (quét IMEI bằng camera) · hộ chiếu thiết bị (checklist 10–15 mục,
4–6 ảnh) · phân hạng A/B/C · đặt hàng online không cần tài khoản (COD / VietQR, giữ máy có hạn) · bán nhanh tại
quầy + phiếu bảo hành · bảng điều khiển (lãi theo máy, máy tồn lâu, doanh thu tháng, xuất sổ doanh thu) · chia sẻ
Facebook/Zalo · 2 vai trò Chủ / Nhân viên.

Ngoài MVP (GĐ2+): form báo giá thu cũ online, thu cũ đổi mới trừ vào đơn, tra bảo hành công khai bằng QR, vận
chuyển GHN/GHTK, hóa đơn điện tử, ký gửi, trả góp, cổng thanh toán. **Bỏ hẳn:** app riêng kỹ thuật viên, AI
định giá, chatbot.

## 4. Lộ trình: 10 kế hoạch con

Mỗi kế hoạch con tạo ra phần mềm chạy được và test được độc lập; làm tuần tự theo thứ tự dưới (mũi tên = phụ thuộc).
Ước lượng cho 1 dev full-stack, cộng lại ≈ 7–7,5 tuần, khớp mức 6–8 tuần của báo cáo cho GĐ1.

| # | Kế hoạch con | Kết quả có thể kiểm tra | Phụ thuộc | Ước lượng |
| --- | --- | --- | --- | --- |
| P1 | **Xác thực & khung quản trị** | Đăng nhập bằng SĐT + mật khẩu, phiên DB, phân quyền Chủ/Nhân viên, khung admin mobile-first, quản lý nhân viên | — | 0,5 tuần |
| P2 | Catalog quản trị | Thêm/sửa model, biến thể, giá tham chiếu, giá máy mới, tồn phụ kiện | P1 | 0,5 tuần |
| P3 | Nhập máy & kho + lưu ảnh | Quét IMEI bằng camera, tạo Acquisition (thông tin người bán, ảnh giấy tờ bucket riêng), danh sách kho lọc theo trạng thái; upload ảnh nén lên R2/S3 qua URL ký | P2 | 1 tuần |
| P10a | **Deploy bản nháp** | Bản staging có backup DB hằng ngày; chủ shop bắt đầu dùng thử (báo cáo: từ tuần 3–4) | P3 | 0,25 tuần |
| P4 | Hộ chiếu thiết bị / kiểm định | Checklist chạm-chọn có phiên bản, % pin, linh kiện đã thay, 4–6 ảnh, chấm hạng, bước xóa dữ liệu + kiểm tra khóa tài khoản bắt buộc → lên kệ / tân trang / loại bỏ | P3 | 1 tuần |
| P5 | Website bán hàng | Trang chủ, danh sách lọc (loại, hạng, giá), tìm kiếm không dấu (`unaccent`), trang máy hiện hộ chiếu + ảnh thật, SEO (metadata, sitemap, JSON-LD) | P4 | 1 tuần |
| P6 | Đặt hàng online & giữ máy | Đặt bằng tên + SĐT, giữ máy theo `reservation.holdMinutes`, mã VietQR, chủ shop xác nhận/hủy, cron dọn giữ quá hạn | P5 | 1 tuần |
| P7 | Bán nhanh tại quầy & bảo hành | Quét IMEI → bán → chụp lại báo cáo kiểm định → tạo phiếu bảo hành; bán kèm phụ kiện trừ tồn; đổi trả → RETURNED | P4 (dùng chung Order với P6) | 0,5 tuần |
| P8 | Bảng điều khiển & sổ doanh thu | Lãi theo máy (nhập chi phí tân trang/khác), cảnh báo tồn lâu, doanh thu tháng, xuất CSV sổ doanh thu; Nhân viên không thấy giá vốn | P6, P7 | 0,75 tuần |
| P9 | Chia sẻ mạng xã hội | Một nút tạo ảnh ghép + nội dung + link trang máy, copy/chia sẻ qua Web Share API | P5 | 0,5 tuần |
| P10b | Bàn giao vận hành | Deploy production, tên miền, tài liệu vận hành 1–2 trang, kiểm tra khôi phục backup | Tất cả | 0,25 tuần |

**Cổng kiểm tra** (theo báo cáo): sau P10a, chủ shop dùng thật mỗi ngày để sửa luồng nhập máy sớm; **không bắt đầu
GĐ2 (thu cũ) khi kho web còn lệch kho thật.**

## 5. Quyết định kỹ thuật đã chốt cho các kế hoạch con

| Chủ đề | Quyết định | Lý do |
| --- | --- | --- |
| Đăng nhập | Phiên lưu DB (bảng `Session`, cookie httpOnly chứa token ngẫu nhiên, DB lưu SHA-256 của token); `proxy.ts` chỉ kiểm tra lạc quan có cookie, kiểm tra thật ở tầng DAL | 2 người dùng, không cần thư viện auth; đăng xuất/khóa nhân viên có hiệu lực ngay |
| Ranh giới code | `src/server/**` là hàm thuần nhận `db` làm tham số, không import Next; phần dính Next (cookies, redirect, `server-only`) nằm ở `src/lib/**` và `src/app/**` | Giữ đường lùi tách backend như báo cáo; test được bằng Vitest |
| Ghi dữ liệu | Server Actions + `zod` để kiểm tra input | Không cần API riêng ở MVP |
| Ảnh | Object storage S3-compatible (Cloudflare R2), upload trực tiếp từ trình duyệt qua presigned URL, nén phía client trước khi tải; giấy tờ người bán ở bucket riêng, chỉ xem qua URL ký tạm | Như báo cáo; server không phải xử lý file lớn |
| Tìm kiếm | PostgreSQL full-text + `unaccent` (extension đã bật) | Vài trăm máy, không cần search engine |
| VietQR | Ảnh QR tạo bằng URL công khai của VietQR theo số tài khoản + số tiền + nội dung (mã đơn); **cần xác minh định dạng URL khi làm P6** | Không cần tích hợp cổng thanh toán |
| Cron | Route handler bảo vệ bằng `CRON_SECRET`, gọi bởi cron của nền tảng hosting | Không cần Redis/hàng đợi |
| Giá & tiền | BigInt VND; khi hiển thị format `vi-VN` | Đã chốt trong khung |
| Kiểm thử | TDD cho `src/server/**`; test DB cho mọi thao tác đổi trạng thái/giữ máy/tính lãi; trang giao diện kiểm tra thủ công theo checklist trong từng kế hoạch | Báo cáo: test phần rủi ro cao trước |

## 6. Giả định đang dùng khi chưa có trả lời khảo sát

| Giả định | Nếu thực tế khác thì |
| --- | --- |
| Ngách chính: **điện thoại + laptop/MacBook**, có phụ kiện bán kèm | Đổi seed và mẫu checklist kiểm định (P4) |
| **Có cửa hàng vật lý** → P7 nằm trong MVP | Không có quầy: bỏ P7, P6 tự tạo phiếu bảo hành khi giao xong |
| Chủ shop tự kiểm định, checklist một mẫu cho điện thoại và một mẫu cho laptop | Có nguồn máy đã tân trang: thêm luồng nhập nhanh bỏ qua tân trang |
| Bảo hành máy cũ mặc định 30 ngày, máy mới theo hãng (cấu hình được) | Chỉ đổi giá trị trong `ShopSetting` |
| Hosting managed (ví dụ Vercel + Postgres managed có backup) | VPS + Docker Compose: P10 thêm việc cấu hình backup, cập nhật |
| Chưa có nhận diện thương hiệu: dùng giao diện shadcn mặc định, màu trung tính | Có logo/màu: thêm 1–2 ngày ở P5 |

## 7. Câu hỏi cần bạn / chủ shop trả lời (theo mức ảnh hưởng)

1. **Có cửa hàng vật lý không?** Quyết định P7 có trong MVP hay không.
2. **Ngách chính và tỷ lệ mới/cũ?** Quyết định mẫu checklist kiểm định và seed.
3. **Ai giữ tài khoản hosting/tên miền và bảo trì sau bàn giao?** Quyết định managed hay VPS (P10).
4. Chính sách bảo hành, đổi trả hiện tại cho máy cũ (thời hạn, điều kiện) để in lên phiếu và trang máy.
5. Số máy tồn, số đơn/tháng, đang quản lý bằng gì; có cần nhập dữ liệu cũ từ Excel không (thêm ~1–2 ngày).
6. Hộ kinh doanh hay doanh nghiệp; kế toán cần mẫu sổ doanh thu nào (P8).

## 8. Rủi ro chính & cách lộ trình xử lý

| Rủi ro | Cách xử lý trong lộ trình |
| --- | --- |
| Chủ shop bỏ nhập liệu → kho lệch | P3/P4 thiết kế cho điện thoại trước; deploy bản nháp sớm (P10a) để sửa luồng từ tuần 3–4 |
| Không ai bảo trì | Managed hosting, backup tự động, tài liệu vận hành (P10b), script đặt lại mật khẩu chủ shop (P1) |
| Thu phải máy trộm cắp | Cổng kiểm định chặn khóa tài khoản (đã có), lưu định danh người bán + cam kết nguồn gốc (P3), lịch sử IMEI (P3) |
| Bán trùng web + quầy | Compare-and-set đã có test; P6/P7 bắt buộc đi qua `reserveDevice`/`transition` |
| Phạm vi phình to | Yêu cầu mới ghi vào backlog GĐ2/Tùy chọn, không chèn vào kế hoạch con đang chạy |
| Lộ dữ liệu người bán / giá vốn | Phân quyền theo `can()` (P1), bucket riêng + URL ký tạm (P3), ẩn giá vốn với Nhân viên (P8) |

## 9. Bước tiếp theo

Kế hoạch chi tiết đã có:

- P1: `docs/superpowers/plans/2026-11-14-p1-xac-thuc-khung-quan-tri.md`
- P2: `docs/superpowers/plans/2026-11-14-p2-catalog-quan-tri.md`
- P3: `docs/superpowers/plans/2026-11-14-p3-nhap-may-kho-anh.md` (thêm MinIO vào Docker Compose để giả lập R2 khi dev;
  thêm chuyển `SOLD → INTAKE` cho máy đã bán được shop mua lại)

P4–P10 viết chi tiết lần lượt ngay trước khi làm, để dùng được những gì học từ kế hoạch trước và câu trả lời khảo sát.
