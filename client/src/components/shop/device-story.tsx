"use client";

// "Từ tay người bán đến tay bạn": dòng thời gian 4 bước bấm được (phương án C).
import { ClipboardCheck, PackageCheck, ShieldCheck, UserCheck } from "lucide-react";
import { useState } from "react";

const STEPS = [
  {
    icon: UserCheck,
    title: "Thu vào",
    text: "Người bán xuất trình giấy tờ tùy thân, cam kết máy thuộc sở hữu hợp pháp. Cửa hàng kiểm tra IMEI không bị nhập nhiều lần bất thường.",
    record: "Ghi lại: người bán, giấy tờ, IMEI",
  },
  {
    icon: ClipboardCheck,
    title: "Kiểm định",
    text: "Chấm 10–14 mục: màn hình, cảm ứng, Face ID, camera, loa, sạc, sóng… Lỗi nhỏ như loa hơi rè cũng ghi rõ, không giấu.",
    record: "Ghi lại: từng mục đạt/lỗi · % pin · hạng A/B/C",
  },
  {
    icon: ShieldCheck,
    title: "Xóa dữ liệu",
    text: "Kiểm tra máy không khóa iCloud/Google, đăng xuất mọi tài khoản và khôi phục cài đặt gốc. Máy khóa tài khoản không bao giờ được bán.",
    record: "Ghi lại: không khóa tài khoản · đã xóa dữ liệu",
  },
  {
    icon: PackageCheck,
    title: "Lên kệ",
    text: "Chụp 4–6 ảnh thật, đặt giá. Hộ chiếu thiết bị đi kèm máy lên website ngay — bạn đọc trước khi đến cửa hàng.",
    record: "Ghi lại: ảnh thật · hộ chiếu công khai",
  },
] as const;

export function DeviceStory() {
  const [active, setActive] = useState(1);
  const step = STEPS[active];
  const Icon = step.icon;

  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={active === i}
              className={`flex w-full flex-col gap-1.5 rounded-2xl border-[1.5px] p-4 text-left transition ${
                active === i ? "border-ink bg-ink text-white" : "bg-card hover:border-ink"
              }`}
            >
              <span className={`font-mono text-xs font-semibold ${active === i ? "text-brand-bright" : "text-brand"}`}>
                0{i + 1}
              </span>
              <span className="text-lg font-extrabold">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center sm:p-8" aria-live="polite">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon className="size-8" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-extrabold">{step.title}</p>
          <p className="leading-relaxed text-foreground/80">{step.text}</p>
          <p className="font-mono text-[13px] font-semibold text-brand">{step.record}</p>
        </div>
      </div>
    </div>
  );
}
