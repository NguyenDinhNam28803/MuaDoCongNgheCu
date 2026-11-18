import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/dal";
import { CONDITION_LABEL, STATUS_LABEL, shortId } from "@/lib/device-labels";
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db";
import { INVENTORY_TABS, PAGE_SIZE, countDevicesByTab, listDevices, type InventoryTab } from "@/server/inventory/queries";

export const metadata: Metadata = { title: "Kho" };

const TAB_LABEL: Record<InventoryTab, string> = {
  processing: "Đang xử lý",
  listed: "Đang bán",
  reserved: "Đang giữ",
  sold: "Đã bán",
  rejected: "Loại bỏ",
};

const STALE_DAYS = 30;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function InventoryPage({ searchParams }: PageProps<"/admin/kho">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: InventoryTab = INVENTORY_TABS.includes(tabParam as InventoryTab) ? (tabParam as InventoryTab) : "listed";
  const q = one(sp.q) ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [{ items, total }, counts] = await Promise.all([
    listDevices(prisma, user, { tab, q, page }),
    countDevicesByTab(prisma),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: Record<string, string | number>) =>
    `/admin/kho?${new URLSearchParams({ tab, ...(q && { q }), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Kho</h1>

      <nav aria-label="Trạng thái kho" className="-mx-4 flex gap-1 overflow-x-auto px-4">
        {INVENTORY_TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/kho?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${t === tab ? "border-ink bg-ink text-white" : "bg-card"}`}
          >
            {TAB_LABEL[t]} ({counts[t]})
          </Link>
        ))}
      </nav>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <Input
          name="q"
          defaultValue={q}
          aria-label="Tìm máy"
          placeholder="4 số cuối IMEI hoặc tên máy"
          className="h-11 flex-1 text-base"
        />
        <button type="submit" className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Tìm
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có máy nào.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/kho/${d.id}`} className="flex justify-between gap-3 rounded-2xl border bg-card p-3.5 hover:border-ink">
                <span className="flex flex-col">
                  <span className="font-medium">{d.productName}</span>
                  <span className="text-sm text-muted-foreground">
                    {d.variantLabel} · {CONDITION_LABEL[d.condition]}
                    {d.grade && ` · Hạng ${d.grade}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shortId(d.imei, d.serial)} · {STATUS_LABEL[d.status]}
                  </span>
                </span>
                <span className="flex flex-col items-end text-right text-sm">
                  <span>{formatVnd(d.listPrice)}</span>
                  {d.costPrice !== undefined && <span className="text-xs text-muted-foreground">Vốn {formatVnd(d.costPrice)}</span>}
                  <span className={`text-xs ${d.ageDays > STALE_DAYS ? "font-semibold text-warn" : "text-muted-foreground"}`}>
                    {d.ageDays} ngày
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })}>← Trước</Link> : <span />}
          <span className="text-muted-foreground">
            Trang {page}/{pages}
          </span>
          {page < pages ? <Link href={href({ page: page + 1 })}>Sau →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
