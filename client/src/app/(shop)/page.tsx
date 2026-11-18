import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Headphones, Laptop, Search, Smartphone, Tablet, Watch } from "lucide-react";
import { conditionBadges, deviceHref, PhotoPlaceholder } from "@/components/shop/device-card";
import { DeviceStory } from "@/components/shop/device-story";
import { Hero3D } from "@/components/shop/hero-3d";
import { TradeInEstimator } from "@/components/shop/trade-in-estimator";
import { formatVnd } from "@/lib/money";
import { homeData, shopInfo } from "@/lib/shop-data";
import { GRADE_CRITERIA } from "@/server/inspection/templates";
import type { PublicDeviceCard } from "@/server/shop/queries";

export async function generateMetadata(): Promise<Metadata> {
  const shop = await shopInfo();
  return {
    title: { absolute: `${shop.name} — điện thoại, laptop mới & cũ kiểm định minh bạch` },
    description: "Mỗi máy cũ có hộ chiếu riêng: ảnh thật, % pin, linh kiện đã thay, lỗi nhỏ cũng ghi rõ.",
  };
}

const SUGGESTIONS = [
  { label: "iPhone cũ", href: "/may?q=iphone&condition=USED" },
  { label: "MacBook", href: "/may?q=macbook" },
  { label: "iPad", href: "/may?q=ipad" },
  { label: "Máy hạng A", href: "/may?grade=A" },
  { label: "Dưới 5 triệu", href: "/may?max=5tr" },
];

const CATEGORIES = [
  { href: "/may?category=PHONE", label: "Điện thoại", icon: Smartphone },
  { href: "/may?category=LAPTOP", label: "Laptop", icon: Laptop },
  { href: "/may?category=TABLET", label: "Máy tính bảng", icon: Tablet },
  { href: "/may?category=WATCH", label: "Đồng hồ", icon: Watch },
  { href: "/phu-kien", label: "Phụ kiện", icon: Headphones },
];

function BentoCard({ d, big }: { d: PublicDeviceCard; big?: boolean }) {
  const badge = conditionBadges(d)[0];
  return (
    <Link
      href={deviceHref(d)}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-3xl border bg-muted ${big ? "col-span-2 p-4 sm:row-span-2 sm:p-5" : "p-2.5"}`}
    >
      {d.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ kho R2/S3
        <img src={d.coverPhotoUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <PhotoPlaceholder className="absolute inset-0" />
      )}
      <span className={`absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs ${badge.className}`}>
        {d.condition === "NEW" ? badge.text : d.grade ? `Hạng ${d.grade}` : "Đã dùng"}
        {d.batteryPct !== null && d.condition === "USED" && ` · Pin ${d.batteryPct}%`}
      </span>
      <span
        className={`relative flex rounded-2xl bg-card/95 backdrop-blur ${
          big ? "items-end justify-between gap-3 p-3.5 sm:p-4" : "flex-col gap-0.5 p-2.5"
        }`}
      >
        <span className="min-w-0">
          <span className={`block font-extrabold leading-tight ${big ? "text-xl sm:text-2xl" : "line-clamp-1 text-sm"}`}>{d.productName}</span>
          <span className="block truncate text-xs text-muted-foreground sm:text-[13px]">{d.variantLabel}</span>
        </span>
        <span className={`font-extrabold text-brand ${big ? "shrink-0 text-lg sm:text-xl" : "text-sm"}`}>{formatVnd(d.listPrice)}</span>
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const [{ latest, totalAvailable, budgets }, shop] = await Promise.all([homeData(), shopInfo()]);

  const faqs = [
    { q: "Hạng A, B, C khác nhau thế nào?", a: (["A", "B", "C"] as const).map((g) => `Hạng ${g}: ${GRADE_CRITERIA[g]}`).join(" ") },
    { q: "Máy cũ được bảo hành ra sao?", a: shop.warrantyText },
    { q: "Nếu máy không đúng như mô tả?", a: shop.returnText },
    {
      q: "Ảnh trên web có phải ảnh thật không?",
      a: "Có. Mỗi máy cũ được chụp 4–6 ảnh tại cửa hàng sau khi kiểm định — bạn thấy đúng chiếc máy sẽ nhận, kể cả vết trầy.",
    },
    {
      q: "Cửa hàng có thu mua / đổi máy cũ không?",
      a: `Có. Mang máy và giấy tờ tùy thân đến ${shop.address}, hoặc nhắn Zalo ${shop.zalo} để hỏi giá trước. Máy còn khóa iCloud/Google không được thu mua.`,
    },
  ];

  return (
    <div className="flex flex-col gap-16">
      <section className="hero3d-grid -mx-4 -mt-6 overflow-hidden bg-ink text-white sm:mx-0 sm:mt-0 sm:rounded-[2rem]">
        <div className="flex flex-col gap-2 px-5 pt-10 sm:px-10 lg:flex-row lg:items-center lg:gap-4 lg:py-4">
          <div className="flex flex-1 flex-col gap-5 lg:py-10">
            <p className="font-mono text-xs font-semibold tracking-[0.16em] text-brand-bright sm:text-sm">MỖI MÁY CŨ ĐỀU CÓ HỘ CHIẾU</p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Máy cũ minh bạch như máy mới
            </h1>
            <form action="/may" method="get" role="search" className="flex h-15 items-center gap-2 rounded-full bg-white py-2 pr-2 pl-5 text-ink shadow-lg">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                name="q"
                type="search"
                aria-label="Bạn đang tìm máy gì"
                placeholder="Tìm iPhone 13, MacBook…"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="h-11 shrink-0 rounded-full bg-brand px-5 font-bold text-white hover:bg-brand-ink">
                Tìm
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Link key={s.href} href={s.href} className="rounded-full border border-white/25 px-3.5 py-1.5 text-sm font-semibold hover:border-white">
                  {s.label}
                </Link>
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
              {["Ảnh thật từng máy", "Kiểm định 10–14 mục", "Đổi trả 7 ngày"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-brand-bright" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:flex-1">
            <Hero3D />
          </div>
        </div>
      </section>

      <section aria-label="Danh mục" className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {CATEGORIES.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-center text-sm font-semibold transition hover:-translate-y-0.5 hover:border-ink"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mới lên kệ</h2>
            <p className="text-sm text-muted-foreground">Vừa kiểm định xong, kèm hộ chiếu từng máy</p>
          </div>
          <Link href="/may" className="inline-flex items-center gap-1 text-sm font-semibold">
            Xem tất cả ({totalAvailable})
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">Đang cập nhật máy mới — quay lại sau ít phút nhé.</p>
        ) : (
          <div className="grid auto-rows-[200px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:grid-cols-4">
            {latest.map((d, i) => (
              <BentoCard key={d.id} d={d} big={i === 0} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="budget" className="flex flex-col gap-4">
        <h2 id="budget" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Mua theo tầm giá
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {budgets.map((b, i) => (
            <Link
              key={b.href}
              href={b.href}
              className={`flex min-h-32 flex-col justify-between gap-2 rounded-3xl p-5 transition hover:-translate-y-0.5 ${
                i === 0 ? "bg-brand-soft text-brand-ink" : i === budgets.length - 1 ? "bg-ink text-white" : "border bg-card"
              }`}
            >
              <span className="font-mono text-[13px] font-semibold opacity-80">{b.count} máy</span>
              <span className="text-xl font-extrabold sm:text-2xl">{b.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="story" className="flex flex-col gap-5">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.16em] text-brand">VÌ SAO MÁY CŨ Ở TECNOVA ĐÁNG TIN</p>
          <h2 id="story" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Từ tay người bán đến tay bạn
          </h2>
        </div>
        <DeviceStory />
      </section>

      <section id="thu-cu" aria-labelledby="estimate" className="grid scroll-mt-32 gap-8 rounded-[2rem] bg-ink p-6 text-white sm:p-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs font-semibold tracking-[0.16em] text-brand-bright">THU CŨ · ĐỔI MỚI</p>
          <h2 id="estimate" className="text-3xl font-extrabold tracking-tight">
            Máy cũ của bạn đáng giá bao nhiêu?
          </h2>
          <p className="leading-relaxed text-white/75">
            Cửa hàng định giá bằng công thức công khai — không ép giá. Chọn tình trạng máy để xem cách tính; giá chốt sau khi xem
            máy thật.
          </p>
        </div>
        <TradeInEstimator zalo={shop.zalo} />
      </section>

      <section aria-labelledby="faq" className="flex flex-col gap-4">
        <h2 id="faq" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Câu hỏi thường gặp
        </h2>
        <div className="flex flex-col divide-y rounded-2xl border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {f.q}
                <span className="text-xl text-muted-foreground transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-4 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
