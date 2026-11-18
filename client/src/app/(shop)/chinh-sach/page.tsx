import type { Metadata } from "next";
import { shopInfo } from "@/lib/shop-data";
import { GRADE_CRITERIA } from "@/server/inspection/templates";

export const metadata: Metadata = {
  title: "Chính sách bảo hành, đổi trả & phân hạng",
  description: "Tiêu chí phân hạng máy A/B/C, chính sách bảo hành, đổi trả và quyền riêng tư.",
};

export default async function PolicyPage() {
  const shop = await shopInfo();
  return (
    <article className="flex max-w-2xl flex-col gap-6 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Chính sách</h1>

      <section id="hang-may" className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Tiêu chí phân hạng máy đã qua sử dụng</h2>
        <ul className="flex flex-col gap-2">
          {(["A", "B", "C"] as const).map((g) => (
            <li key={g}>
              <span className="font-medium">Hạng {g}:</span> {GRADE_CRITERIA[g]}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          &ldquo;Nguyên trạng&rdquo; là máy chưa thay linh kiện; &ldquo;Đã tân trang&rdquo; là máy đã được thay linh kiện hoặc làm mới
          vỏ — linh kiện đã thay luôn được ghi trong hộ chiếu thiết bị.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Bảo hành</h2>
        <p>{shop.warrantyText}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Đổi trả</h2>
        <p>{shop.returnText}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Thu mua máy cũ</h2>
        <p>
          Cửa hàng chỉ nhận máy có nguồn gốc rõ ràng: người bán xuất trình giấy tờ tùy thân và cam kết quyền sở hữu. Máy còn
          khóa iCloud/Google/MDM không được thu mua.
        </p>
      </section>

      <section id="quyen-rieng-tu" className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Quyền riêng tư</h2>
        <p>
          Thông tin người bán máy (họ tên, số điện thoại, ảnh giấy tờ) chỉ dùng để đối chiếu nguồn gốc, lưu riêng và chỉ chủ cửa
          hàng xem được. Dữ liệu trên máy thu mua được xóa trước khi bán lại. Bạn có thể yêu cầu xem hoặc xóa thông tin của mình
          bằng cách liên hệ {shop.phone}.
        </p>
      </section>
    </article>
  );
}
