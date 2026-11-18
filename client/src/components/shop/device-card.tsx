import Link from "next/link";
import { formatVnd } from "@/lib/money";
import type { PublicDeviceCard } from "@/server/shop/queries";

type Badge = { text: string; className: string };

/** Nhãn tình trạng theo bộ nhận diện TECNOVA. */
export function conditionBadges(d: Pick<PublicDeviceCard, "condition" | "grade" | "isRefurbished">): Badge[] {
  if (d.condition === "NEW") return [{ text: "Mới", className: "bg-ink text-white" }];
  return [
    { text: d.grade ? `Đã dùng · Hạng ${d.grade}` : "Đã dùng", className: "bg-brand-soft text-brand-ink" },
    { text: d.isRefurbished ? "Đã tân trang" : "Nguyên trạng", className: "bg-muted text-foreground" },
  ];
}

export function deviceHref(d: Pick<PublicDeviceCard, "slug" | "id">): string {
  return `/may/${d.slug}-${d.id}`;
}

export function PhotoPlaceholder({ className = "" }: { className?: string }) {
  return <div className={`bg-[repeating-linear-gradient(135deg,#eef1f4_0_12px,#e6ebef_12px_24px)] ${className}`} aria-hidden="true" />;
}

export function DeviceCard({ d }: { d: PublicDeviceCard }) {
  return (
    <li>
      <Link
        href={deviceHref(d)}
        className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="aspect-square bg-muted">
          {d.coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ kho R2/S3
            <img src={d.coverPhotoUrl} alt={`${d.productName} ${d.variantLabel}`} loading="lazy" className="size-full object-cover" />
          ) : (
            <PhotoPlaceholder className="size-full" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <p className="font-bold leading-snug">{d.productName}</p>
          <p className="text-[13px] text-muted-foreground">{d.variantLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {conditionBadges(d).slice(0, 1).map((b) => (
              <span key={b.text} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.className}`}>
                {b.text}
              </span>
            ))}
            {d.batteryPct !== null && d.condition === "USED" && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs">Pin {d.batteryPct}%</span>
            )}
          </div>
          <p className="mt-auto pt-1.5 text-lg font-extrabold">{formatVnd(d.listPrice)}</p>
        </div>
      </Link>
    </li>
  );
}

export function DeviceGrid({ items }: { items: PublicDeviceCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((d) => (
        <DeviceCard key={d.id} d={d} />
      ))}
    </ul>
  );
}
