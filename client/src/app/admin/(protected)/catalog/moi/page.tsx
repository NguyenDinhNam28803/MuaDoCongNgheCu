import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { NewProductForm } from "./new-product-form";

export const metadata: Metadata = { title: "Thêm model" };

export default async function NewProductPage() {
  await requirePermission("catalog.manage");
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Link href="/admin/catalog" className="text-sm text-muted-foreground">
        ← Catalog
      </Link>
      <h1 className="text-xl font-semibold">Thêm model</h1>
      <NewProductForm />
    </div>
  );
}
