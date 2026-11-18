import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeviceGrid } from "@/components/shop/device-card";
import type { Condition, Grade, ProductCategory } from "@/generated/prisma/enums";
import { parseVndInput } from "@/lib/money";
import { deviceList, type DeviceListParams } from "@/lib/shop-data";
import { CATEGORY_LABEL } from "@/server/catalog/schemas";
import { SHOP_PAGE_SIZE } from "@/server/shop/queries";

export const metadata: Metadata = {
  title: "Tất cả máy đang bán",
  description: "Điện thoại, laptop, máy tính bảng mới và đã qua sử dụng, có báo cáo kiểm định từng máy.",
};

const CATEGORIES = ["PHONE", "LAPTOP", "TABLET", "WATCH", "OTHER"] as const;
const SORTS = { newest: "Mới lên kệ", "price-asc": "Giá thấp → cao", "price-desc": "Giá cao → thấp" } as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : undefined);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

/** Đọc bộ lọc từ URL; giá trị sai bị bỏ qua (không lỗi). */
function parseFilters(sp: SP): DeviceListParams & { minRaw: string; maxRaw: string } {
  const minRaw = one(sp.min) ?? "";
  const maxRaw = one(sp.max) ?? "";
  const min = minRaw ? parseVndInput(minRaw) : null;
  const max = maxRaw ? parseVndInput(maxRaw) : null;
  return {
    q: one(sp.q) || undefined,
    category: pick<ProductCategory>(one(sp.category), CATEGORIES),
    condition: pick<Condition>(one(sp.condition), ["NEW", "USED"]),
    grade: pick<Grade>(one(sp.grade), ["A", "B", "C"]),
    minPrice: min !== null ? min.toString() : undefined,
    maxPrice: max !== null ? max.toString() : undefined,
    sort: pick(one(sp.sort), ["newest", "price-asc", "price-desc"] as const),
    page: Math.max(1, Number(one(sp.page)) || 1),
    minRaw,
    maxRaw,
  };
}

const control = "h-11 w-full rounded-xl border-[1.5px] border-input bg-card px-3 text-sm sm:w-auto";
const field = "flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground";

async function Results({ searchParams }: { searchParams: Promise<SP> }) {
  const f = parseFilters(await searchParams);
  const { minRaw, maxRaw, ...params } = f;
  const { items, total } = await deviceList(params);
  const pages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));

  const href = (patch: Record<string, string | number | undefined>) => {
    const base: Record<string, string | number | undefined> = {
      q: f.q,
      category: f.category,
      condition: f.condition,
      grade: f.grade,
      min: minRaw || undefined,
      max: maxRaw || undefined,
      sort: f.sort,
      page: undefined,
      ...patch,
    };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== "") qs.set(k, String(v));
    const s = qs.toString();
    return s ? `/may?${s}` : "/may";
  };
  const hasFilters = !!(f.condition || f.grade || minRaw || maxRaw);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {f.q ? `Kết quả cho “${f.q}”` : f.category ? CATEGORY_LABEL[f.category] : "Tất cả máy đang bán"}
        </h1>
        <p className="text-muted-foreground">
          <span>{total} máy</span> · mỗi máy có hộ chiếu kiểm định
        </p>
      </div>

      <nav aria-label="Loại máy" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[undefined, ...CATEGORIES].map((c) => {
          const active = f.category === c;
          return (
            <Link
              key={c ?? "all"}
              href={href({ category: c })}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 shrink-0 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold ${
                active ? "border-ink bg-ink text-white" : "bg-card hover:border-ink"
              }`}
            >
              {c ? CATEGORY_LABEL[c] : "Tất cả"}
            </Link>
          );
        })}
      </nav>

      {/* Điện thoại: lưới 2 cột cho gọn; màn rộng: một hàng tự xuống dòng */}
      <form method="get" className="grid grid-cols-2 gap-2.5 rounded-2xl border bg-card p-3.5 sm:flex sm:flex-wrap sm:items-end">
        {f.q && <input type="hidden" name="q" value={f.q} />}
        {f.category && <input type="hidden" name="category" value={f.category} />}
        <label className={field}>
          Tình trạng
          <select name="condition" defaultValue={f.condition ?? ""} className={`${control} text-foreground`}>
            <option value="">Mới & đã dùng</option>
            <option value="NEW">Mới</option>
            <option value="USED">Đã dùng</option>
          </select>
        </label>
        <label className={field}>
          Hạng
          <select name="grade" defaultValue={f.grade ?? ""} className={`${control} text-foreground`}>
            <option value="">Mọi hạng</option>
            <option value="A">Hạng A</option>
            <option value="B">Hạng B</option>
            <option value="C">Hạng C</option>
          </select>
        </label>
        <label className={field}>
          Giá từ
          <input name="min" defaultValue={minRaw} placeholder="vd 5tr" className={`${control} text-foreground sm:w-28`} />
        </label>
        <label className={field}>
          Giá đến
          <input name="max" defaultValue={maxRaw} placeholder="vd 15tr" className={`${control} text-foreground sm:w-28`} />
        </label>
        <label className={`${field} col-span-2`}>
          Sắp xếp
          <select name="sort" defaultValue={f.sort ?? "newest"} className={`${control} text-foreground`}>
            {Object.entries(SORTS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`h-11 rounded-xl bg-ink px-5 text-sm font-bold text-white ${hasFilters ? "" : "col-span-2"}`}>
          Lọc
        </button>
        {hasFilters && (
          <Link
            href={href({ condition: undefined, grade: undefined, min: undefined, max: undefined })}
            className="flex h-11 items-center justify-center px-1 text-sm font-semibold underline underline-offset-4 sm:justify-start"
          >
            Xóa bộ lọc
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Chưa có máy phù hợp.</p>
          <p className="text-sm text-muted-foreground">Thử bỏ bớt bộ lọc, hoặc gọi cho cửa hàng để được tìm giúp.</p>
        </div>
      ) : (
        <DeviceGrid items={items} />
      )}

      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-center gap-2">
          {f.page! > 1 && (
            <Link href={href({ page: f.page! - 1 })} className="flex h-11 items-center rounded-xl border-[1.5px] bg-card px-4 text-sm font-semibold">
              ← Trước
            </Link>
          )}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - f.page!) <= 2 || p === 1 || p === pages)
            .map((p) => (
              <Link
                key={p}
                href={href({ page: p })}
                aria-current={p === f.page ? "page" : undefined}
                className={`flex size-11 items-center justify-center rounded-xl text-sm font-bold ${p === f.page ? "bg-ink text-white" : "border-[1.5px] bg-card"}`}
              >
                {p}
              </Link>
            ))}
          {f.page! < pages && (
            <Link href={href({ page: f.page! + 1 })} className="flex h-11 items-center rounded-xl border-[1.5px] bg-card px-4 text-sm font-semibold">
              Sau →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default function DeviceListPage({ searchParams }: PageProps<"/may">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải danh sách máy…</p>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
