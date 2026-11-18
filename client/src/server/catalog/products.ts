// Catalog: model (Product) → biến thể (ProductVariant). Slug/SKU tự sinh; không xóa cứng khi đã có hàng.
import type { z } from "zod";
import type { ProductCategory } from "@/generated/prisma/enums";
import { slugify } from "@/lib/slug";
import type { Db } from "../db";
import { CatalogRuleError } from "./errors";
import {
  productInputSchema,
  variantInputSchema,
  type ProductInput,
  type VariantInput,
} from "./schemas";

export type { ProductInput, VariantInput };

type VariantAttrs = { storage?: string | null; ram?: string | null; color?: string | null };

/** "8GB/256GB · Titan đen"; chỉ dung lượng → "256GB"; không có gì → "Mặc định". */
export function variantLabel(v: VariantAttrs): string {
  const spec = [v.ram, v.storage].filter(Boolean).join("/");
  const label = [spec, v.color].filter(Boolean).join(" · ");
  return label || "Mặc định";
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new CatalogRuleError(r.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
  return r.data;
}

async function uniqueValue(base: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  if (!(await exists(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
}

function skuBase(productName: string, v: VariantAttrs): string {
  return slugify([productName, v.storage, v.ram, v.color].filter(Boolean).join(" ")).toUpperCase() || "SKU";
}

async function uniqueSku(db: Db, productName: string, v: VariantAttrs): Promise<string> {
  return uniqueValue(skuBase(productName, v), async (sku) => !!(await db.productVariant.findUnique({ where: { sku } })));
}

export async function createProduct(
  db: Db,
  input: ProductInput & { firstVariant: VariantInput },
): Promise<{ productId: string }> {
  const product = parse(productInputSchema, input);
  const variant = parse(variantInputSchema, input.firstVariant);
  const slug = await uniqueValue(slugify(product.name) || "san-pham", async (s) => !!(await db.product.findUnique({ where: { slug: s } })));
  const sku = await uniqueSku(db, product.name, variant);

  const created = await db.product.create({
    data: { ...product, slug, variants: { create: { ...variant, sku } } },
    select: { id: true },
  });
  return { productId: created.id };
}

/** Slug giữ nguyên khi đổi tên để link cũ không gãy. */
export async function updateProduct(db: Db, productId: string, input: ProductInput): Promise<void> {
  const data = parse(productInputSchema, input);
  await db.product.update({ where: { id: productId }, data });
}

export async function addVariant(db: Db, productId: string, input: VariantInput): Promise<{ variantId: string }> {
  const variant = parse(variantInputSchema, input);
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { name: true } });
  const sku = await uniqueSku(db, product.name, variant);
  const created = await db.productVariant.create({ data: { ...variant, sku, productId }, select: { id: true } });
  return { variantId: created.id };
}

/** SKU giữ nguyên khi sửa. */
export async function updateVariant(db: Db, variantId: string, input: VariantInput): Promise<void> {
  const data = parse(variantInputSchema, input);
  const current = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { isSerialized: true, stockQty: true, _count: { select: { devices: true } } },
  });
  if (current.isSerialized !== data.isSerialized && (current._count.devices > 0 || current.stockQty > 0)) {
    throw new CatalogRuleError("Không thể đổi loại quản lý khi đã có hàng");
  }
  await db.productVariant.update({ where: { id: variantId }, data });
}

export async function deleteVariant(db: Db, variantId: string): Promise<void> {
  const v = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { stockQty: true, _count: { select: { devices: true, orderItems: true } } },
  });
  if (v._count.devices > 0 || v._count.orderItems > 0 || v.stockQty > 0) {
    throw new CatalogRuleError("Biến thể đã có máy hoặc đơn hàng, chỉ có thể ẩn");
  }
  await db.productVariant.delete({ where: { id: variantId } });
}

export async function setArchived(
  db: Db,
  target: { productId: string } | { variantId: string },
  archived: boolean,
): Promise<void> {
  if ("productId" in target) {
    await db.product.update({ where: { id: target.productId }, data: { archived } });
  } else {
    await db.productVariant.update({ where: { id: target.variantId }, data: { archived } });
  }
}

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  archived: boolean;
  variantCount: number;
  listedDeviceCount: number;
};

const searchKey = (s: string) => slugify(s).replace(/-/g, "");

export async function listProducts(
  db: Db,
  filter: { q?: string; category?: ProductCategory; includeArchived?: boolean },
): Promise<ProductListItem[]> {
  const rows = await db.product.findMany({
    where: {
      ...(filter.category && { category: filter.category }),
      ...(!filter.includeArchived && { archived: false }),
    },
    orderBy: { name: "asc" },
    include: {
      variants: { select: { archived: true, _count: { select: { devices: { where: { status: "LISTED" } } } } } },
    },
  });
  const q = filter.q ? searchKey(filter.q) : "";

  return rows
    .filter((p) => !q || searchKey(`${p.brand} ${p.name}`).includes(q))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      archived: p.archived,
      variantCount: p.variants.filter((v) => filter.includeArchived || !v.archived).length,
      listedDeviceCount: p.variants.reduce((n, v) => n + v._count.devices, 0),
    }));
}

export type VariantDetail = {
  id: string;
  sku: string;
  storage: string | null;
  ram: string | null;
  color: string | null;
  label: string;
  isSerialized: boolean;
  referencePrice: bigint | null;
  newPrice: bigint | null;
  stockQty: number;
  archived: boolean;
  deviceCount: number;
  listedDeviceCount: number;
  canDelete: boolean;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  archived: boolean;
  variants: VariantDetail[];
};

export async function getProduct(db: Db, productId: string): Promise<ProductDetail | null> {
  const p = await db.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { devices: true, orderItems: true } } },
      },
    },
  });
  if (!p) return null;

  const listed = await db.device.groupBy({
    by: ["variantId"],
    where: { variantId: { in: p.variants.map((v) => v.id) }, status: "LISTED" },
    _count: { _all: true },
  });
  const listedBy = new Map(listed.map((r) => [r.variantId, r._count._all]));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    archived: p.archived,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      storage: v.storage,
      ram: v.ram,
      color: v.color,
      label: variantLabel(v),
      isSerialized: v.isSerialized,
      referencePrice: v.referencePrice,
      newPrice: v.newPrice,
      stockQty: v.stockQty,
      archived: v.archived,
      deviceCount: v._count.devices,
      listedDeviceCount: listedBy.get(v.id) ?? 0,
      canDelete: v._count.devices === 0 && v._count.orderItems === 0 && v.stockQty === 0,
    })),
  };
}

export type VariantSearchResult = {
  variantId: string;
  productName: string;
  label: string;
  category: ProductCategory;
  isSerialized: boolean;
  referencePrice: bigint | null;
  newPrice: bigint | null;
};

/** Tìm biến thể để chọn khi nhập máy/bán hàng. Không dấu, bỏ khoảng trắng; tối đa 20 kết quả. */
export async function searchVariants(
  db: Db,
  q: string,
  opts: { serializedOnly?: boolean } = {},
): Promise<VariantSearchResult[]> {
  const key = searchKey(q);
  if (!key) return [];
  const rows = await db.productVariant.findMany({
    where: {
      archived: false,
      product: { archived: false },
      ...(opts.serializedOnly && { isSerialized: true }),
    },
    include: { product: { select: { name: true, brand: true, category: true } } },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "asc" }],
  });

  const results: VariantSearchResult[] = [];
  for (const v of rows) {
    const label = variantLabel(v);
    if (!searchKey(`${v.product.brand} ${v.product.name} ${label}`).includes(key)) continue;
    results.push({
      variantId: v.id,
      productName: v.product.name,
      label,
      category: v.product.category,
      isSerialized: v.isSerialized,
      referencePrice: v.referencePrice,
      newPrice: v.newPrice,
    });
    if (results.length === 20) break;
  }
  return results;
}
