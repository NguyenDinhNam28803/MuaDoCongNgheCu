import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductCategory } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { listProducts } from "@/server/catalog/products";
import { CATEGORY_LABEL, PRODUCT_CATEGORIES } from "@/server/catalog/schemas";

export const metadata: Metadata = { title: "Catalog" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CatalogPage({ searchParams }: PageProps<"/admin/catalog">) {
  await requirePermission("catalog.manage");
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const categoryParam = one(sp.category);
  const category = PRODUCT_CATEGORIES.includes(categoryParam as ProductCategory)
    ? (categoryParam as ProductCategory)
    : undefined;
  const includeArchived = one(sp.archived) === "1";

  const products = await listProducts(prisma, { q, category, includeArchived });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Catalog</h1>
        <Link href="/admin/catalog/moi" className={buttonVariants()}>
          Thêm model
        </Link>
      </div>

      <form method="get" className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Tìm tên model hoặc hãng"
          aria-label="Tìm model"
          className="h-11 text-base sm:flex-1"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          aria-label="Loại"
          className="h-11 rounded-lg border border-input bg-background px-3 text-base"
        >
          <option value="">Tất cả loại</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="size-4" />
          Hiện mục đã ẩn
        </label>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Lọc
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có model nào phù hợp.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/catalog/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted"
              >
                <span className="flex flex-col">
                  <span className="font-medium">
                    {p.name}
                    {p.archived && <span className="ml-2 text-xs text-muted-foreground">(đã ẩn)</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {p.brand} · {CATEGORY_LABEL[p.category]}
                  </span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {p.variantCount} biến thể
                  <br />
                  {p.listedDeviceCount} máy đang bán
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
