import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { getProduct } from "@/server/catalog/products";
import { AddVariantForm } from "./add-variant-form";
import { ProductForm } from "./product-form";
import { VariantItem } from "./variant-item";

export const metadata: Metadata = { title: "Sửa model" };

export default async function ProductPage({ params }: PageProps<"/admin/catalog/[productId]">) {
  await requirePermission("catalog.manage");
  const { productId } = await params;
  const product = await getProduct(prisma, productId);
  if (!product) notFound();

  // Model là phụ kiện nếu mọi biến thể đều quản lý theo số lượng.
  const isSerialized = product.variants.length === 0 || product.variants.some((v) => v.isSerialized);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link href="/admin/catalog" className="text-sm text-muted-foreground">
        ← Catalog
      </Link>
      <h1 className="text-xl font-semibold">{product.name}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Biến thể</h2>
        <ul className="flex flex-col gap-2">
          {product.variants.map((v) => (
            <VariantItem key={v.id} productId={product.id} v={v} />
          ))}
        </ul>
      </section>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Thêm biến thể</summary>
        <div className="pt-3">
          <AddVariantForm productId={product.id} isSerialized={isSerialized} />
        </div>
      </details>

      <section className="flex flex-col gap-3 rounded-lg border p-3">
        <h2 className="font-medium">Thông tin model</h2>
        <ProductForm product={product} />
      </section>
    </div>
  );
}
