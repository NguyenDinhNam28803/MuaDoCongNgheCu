import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, Check, ChevronDown, MessageCircle, Phone } from "lucide-react";
import { VerifiedStamp } from "@/components/brand/logo";
import { conditionBadges, DeviceGrid, deviceHref, PhotoPlaceholder } from "@/components/shop/device-card";
import { buttonVariants } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { deviceDetail, shopInfo, similarDevices } from "@/lib/shop-data";
import { GRADE_CRITERIA } from "@/server/inspection/templates";
import { parseDeviceParam, type PublicDeviceDetail } from "@/server/shop/queries";

const dateFmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });

export async function generateMetadata({ params }: PageProps<"/may/[slug]">): Promise<Metadata> {
  const d = await deviceDetail(parseDeviceParam((await params).slug));
  if (!d) return { title: "Không tìm thấy máy" };
  const title = `${d.productName} ${d.variantLabel} ${d.condition === "NEW" ? "mới" : `cũ hạng ${d.grade ?? ""}`}`.trim();
  return {
    title,
    description: `${title} — ${formatVnd(d.listPrice)}. ${d.batteryPct !== null ? `Pin ${d.batteryPct}%. ` : ""}Ảnh thật, báo cáo kiểm định chi tiết.`,
    alternates: { canonical: deviceHref(d) },
    openGraph: { images: d.photos.slice(0, 1) },
    robots: d.status === "sold" ? { index: false } : undefined,
  };
}

function jsonLd(d: PublicDeviceDetail, shopName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${d.productName} ${d.variantLabel}`,
    brand: { "@type": "Brand", name: d.brand },
    image: d.photos,
    itemCondition:
      d.condition === "NEW"
        ? "https://schema.org/NewCondition"
        : d.isRefurbished
          ? "https://schema.org/RefurbishedCondition"
          : "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: d.listPrice?.toString(),
      availability: d.status === "available" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: siteUrl(deviceHref(d)),
      seller: { "@type": "Organization", name: shopName },
    },
  };
}

function Stat({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-background p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-xl font-semibold" : "text-base font-bold"}`}>{value}</dd>
    </div>
  );
}

async function DeviceView({ params }: { params: PageProps<"/may/[slug]">["params"] }) {
  const { slug } = await params;
  const id = parseDeviceParam(slug);
  const [d, shop] = await Promise.all([deviceDetail(id), shopInfo()]);
  if (!d) notFound();
  if (slug !== `${d.slug}-${d.id}`) permanentRedirect(deviceHref(d));

  if (d.status === "sold") {
    const similar = await similarDevices(d.category, d.id);
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-extrabold">Máy đã bán</h1>
        <p className="text-muted-foreground">
          {d.productName} {d.variantLabel} đã có chủ mới. Bạn xem thử các máy tương tự bên dưới.
        </p>
        {similar.length > 0 && <DeviceGrid items={similar} />}
        <Link href="/may" className={buttonVariants({ variant: "outline", className: "self-start rounded-xl border-ink" })}>
          Xem tất cả máy đang bán
        </Link>
      </div>
    );
  }

  const code = d.id.slice(-6).toUpperCase();
  const checklist = d.report?.checklist ?? [];
  const issues = checklist.filter((c) => c.result === "issue");
  const passed = checklist.filter((c) => c.result === "ok").length;
  const applicable = checklist.filter((c) => c.result !== "na").length;

  return (
    <div className="flex flex-col gap-10 pb-24 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(d, shop.name)) }} />

      <article className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start">
        <section aria-label="Ảnh thật của máy" className="flex flex-col gap-2">
          {d.photos.length === 0 ? (
            <PhotoPlaceholder className="aspect-square rounded-3xl border" />
          ) : (
            <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-2 lg:px-0">
              {d.photos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ kho R2/S3
                <img
                  key={src}
                  src={src}
                  alt={`Ảnh thật ${i + 1} của ${d.productName}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className={`aspect-square w-4/5 shrink-0 snap-center rounded-3xl border object-cover lg:w-full ${i === 0 ? "lg:col-span-2" : ""}`}
                />
              ))}
            </div>
          )}
          <p className="text-[13px] text-muted-foreground">Ảnh chụp chính chiếc máy này tại cửa hàng, không dùng ảnh mạng.</p>
        </section>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
              {d.productName} <span className="font-medium text-muted-foreground">{d.variantLabel}</span>
            </h1>
            <div className="flex flex-wrap gap-2">
              {conditionBadges(d).map((b) => (
                <span key={b.text} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${b.className}`}>
                  {b.text}
                </span>
              ))}
              {d.batteryPct !== null && d.condition === "USED" && (
                <span className="rounded-full bg-muted px-3 py-1 font-mono text-[13px]">Pin {d.batteryPct}%</span>
              )}
              {d.regionCode && <span className="rounded-full bg-muted px-3 py-1 font-mono text-[13px]">{d.regionCode}</span>}
            </div>
            <p className="pt-1 text-3xl font-extrabold text-brand">{formatVnd(d.listPrice)}</p>
            {d.status === "reserved" && (
              <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn-ink">Đang có khách giữ máy — liên hệ để xếp hàng chờ.</p>
            )}
            <p className="font-mono text-[13px] text-muted-foreground">Mã máy: {code}</p>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2.5 border-t bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <a href={`tel:${shop.phone}`} className={buttonVariants({ className: "h-13 flex-1 gap-2 rounded-xl text-base" })}>
              <Phone className="size-4" aria-hidden />
              {/* Thanh dính đáy trên điện thoại: nhãn ngắn để hai nút không bị cắt chữ */}
              <span className="lg:hidden">Gọi ngay</span>
              <span className="hidden lg:inline">Gọi {shop.phone}</span>
            </a>
            <a
              href={`https://zalo.me/${shop.zalo}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "h-13 flex-1 gap-2 rounded-xl border-ink text-base" })}
            >
              <MessageCircle className="size-4" aria-hidden />
              <span className="lg:hidden">Zalo · mã {code}</span>
              <span className="hidden lg:inline">Nhắn Zalo (báo mã {code})</span>
            </a>
          </div>

          <section aria-labelledby="passport" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="passport" className="text-xl font-extrabold">
                  Hộ chiếu thiết bị
                </h2>
                {d.report && (
                  <p className="font-mono text-xs text-muted-foreground">
                    Kiểm định {dateFmt.format(d.report.createdAt)} · mẫu v{d.report.templateVersion}
                  </p>
                )}
              </div>
              <VerifiedStamp />
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {d.grade && <Stat label="Hạng" value={`Hạng ${d.grade}`} />}
              {d.batteryPct !== null && <Stat label="Pin" value={`${d.batteryPct}%`} mono />}
              {applicable > 0 && <Stat label="Mục đạt" value={`${passed}/${applicable}`} mono />}
              <Stat
                label="Tình trạng"
                value={d.condition === "NEW" ? "Mới" : d.isRefurbished ? "Đã qua sử dụng, đã tân trang" : "Đã qua sử dụng, nguyên trạng"}
              />
              <Stat label="Linh kiện đã thay" value={d.report?.replacedParts.length ? d.report.replacedParts.join(", ") : "Không"} />
              {d.regionCode && <Stat label="Mã vùng" value={d.regionCode} mono />}
            </dl>

            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Check className="size-4 text-brand" aria-hidden />
                Không khóa iCloud/Google, đã xóa dữ liệu chủ cũ
              </li>
            </ul>

            {issues.length > 0 && (
              <div className="flex gap-2.5 rounded-xl bg-warn-soft p-3.5 text-warn-ink">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
                <div>
                  <p className="font-bold">{issues.length} lỗi đã ghi nhận</p>
                  <ul className="mt-0.5 text-sm leading-relaxed">
                    {issues.map((c) => (
                      <li key={c.key}>
                        {c.label}
                        {c.note && `: ${c.note}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {checklist.length > 0 && (
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-bold [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
                  Xem đủ {checklist.length} mục kiểm tra
                </summary>
                <ul className="grid gap-x-6 sm:grid-cols-2">
                  {checklist.map((c) => (
                    <li key={c.key} className="flex justify-between gap-3 border-b border-muted py-2 text-sm">
                      <span>{c.label}</span>
                      <span className={`shrink-0 font-semibold ${c.result === "issue" ? "text-warn" : c.result === "ok" ? "text-brand" : "text-muted-foreground"}`}>
                        {c.result === "ok" ? "Đạt" : c.result === "issue" ? "Lỗi" : "Không áp dụng"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {d.grade && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Hạng {d.grade}: {GRADE_CRITERIA[d.grade]}
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-bold">Bảo hành</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{d.condition === "NEW" ? "Bảo hành chính hãng." : shop.warrantyText}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-bold">Đổi trả</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{shop.returnText}</p>
            </div>
          </section>
          <Link href="/chinh-sach" className="self-start text-sm font-semibold underline underline-offset-4">
            Xem chính sách đầy đủ
          </Link>
        </div>
      </article>
    </div>
  );
}

export default function DevicePage({ params }: PageProps<"/may/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải thông tin máy…</p>}>
      <DeviceView params={params} />
    </Suspense>
  );
}
