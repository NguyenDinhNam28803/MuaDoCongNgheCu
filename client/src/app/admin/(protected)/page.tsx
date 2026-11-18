import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, PackagePlus, Settings, Warehouse } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { can } from "@/server/auth/permissions";
import { countDevicesByTab } from "@/server/inventory/queries";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function AdminHomePage() {
  const user = await requireUser();
  const counts = await countDevicesByTab(prisma);

  const stats = [
    { label: "Chờ xử lý", value: counts.processing, href: "/admin/kho?tab=processing", hint: "nhập / kiểm định / tân trang" },
    { label: "Đang bán", value: counts.listed, href: "/admin/kho?tab=listed", hint: "đang hiện trên website" },
    { label: "Đang giữ", value: counts.reserved, href: "/admin/kho?tab=reserved", hint: "khách đã đặt" },
  ];
  const actions = [
    { label: "Nhập máy", href: "/admin/nhap-may", icon: PackagePlus, show: can(user.role, "device.intake") },
    { label: "Kiểm định", href: "/admin/kho?tab=processing", icon: ClipboardCheck, show: can(user.role, "device.inspect") },
    { label: "Xem kho", href: "/admin/kho", icon: Warehouse, show: true },
    { label: "Cài đặt cửa hàng", href: "/admin/cai-dat", icon: Settings, show: can(user.role, "user.manage") },
  ].filter((a) => a.show);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Xin chào, {user.name}</h1>
        <p className="text-sm text-muted-foreground">Hôm nay cần làm gì?</p>
      </div>

      <section aria-label="Kho hiện tại" className="grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col gap-0.5 rounded-2xl border bg-card p-3.5 hover:border-ink">
            <span className="font-mono text-2xl font-semibold">{s.value}</span>
            <span className="text-sm font-semibold">{s.label}</span>
            <span className="hidden text-xs text-muted-foreground sm:block">{s.hint}</span>
          </Link>
        ))}
      </section>

      <section aria-label="Thao tác nhanh" className="grid grid-cols-2 gap-2.5">
        {actions.map(({ label, href, icon: Icon }, i) => (
          <Link
            key={label}
            href={href}
            className={`flex min-h-24 flex-col justify-between gap-3 rounded-2xl p-4 font-semibold ${
              i === 0 ? "bg-ink text-white" : "border bg-card hover:border-ink"
            }`}
          >
            <Icon className={`size-6 ${i === 0 ? "text-brand-bright" : "text-brand"}`} aria-hidden />
            {label}
          </Link>
        ))}
      </section>
    </div>
  );
}
