// Dữ liệu cho website công khai. DTO dựng tay, CHỈ trường công khai:
// không giá vốn, không nguồn nhập/người bán, không người kiểm định, không IMEI/serial.
import type { Condition, DeviceStatus, Grade, ProductCategory } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import type { Db } from "../db";
import { variantLabel } from "../catalog/products";
import { CATEGORY_LABEL } from "../catalog/schemas";
import { availableForSaleWhere } from "../devices/service";
import type { ChecklistResult } from "../inspection/templates";
import { publicUrl } from "../storage/s3";

export const SHOP_PAGE_SIZE = 24;

export type PublicDeviceCard = {
  id: string;
  slug: string;
  productName: string;
  variantLabel: string;
  category: ProductCategory;
  condition: Condition;
  grade: Grade | null;
  isRefurbished: boolean;
  batteryPct: number | null;
  listPrice: bigint | null;
  coverPhotoUrl: string | null;
};

export type PublicDeviceDetail = PublicDeviceCard & {
  status: "available" | "reserved" | "sold";
  brand: string;
  regionCode: string | null;
  photos: string[];
  report: { createdAt: Date; templateVersion: number; checklist: ChecklistResult[]; replacedParts: string[] } | null;
};

export type PublicDeviceFilter = {
  q?: string;
  category?: ProductCategory;
  condition?: Condition;
  grade?: Grade;
  minPrice?: bigint;
  maxPrice?: bigint;
  sort?: "newest" | "price-asc" | "price-desc";
  page?: number;
};

export function deviceSlug(productName: string, label: string): string {
  return slugify(`${productName} ${label}`);
}

/** "/may/iphone-13-128gb-<id>" → id (cuid không có dấu gạch). */
export function parseDeviceParam(param: string): string {
  return param.slice(param.lastIndexOf("-") + 1);
}

const cardSelect = {
  id: true,
  condition: true,
  grade: true,
  isRefurbished: true,
  batteryPct: true,
  listPrice: true,
  variant: {
    select: {
      storage: true,
      ram: true,
      color: true,
      product: { select: { name: true, brand: true, category: true } },
    },
  },
  inspections: { orderBy: { createdAt: "desc" }, take: 1, select: { photoKeys: true } },
} as const;

type CardRow = Prisma.DeviceGetPayload<{ select: typeof cardSelect }>;

function toCard(row: CardRow): PublicDeviceCard {
  const label = variantLabel(row.variant);
  const cover = row.inspections[0]?.photoKeys[0];
  return {
    id: row.id,
    slug: deviceSlug(row.variant.product.name, label),
    productName: row.variant.product.name,
    variantLabel: label,
    category: row.variant.product.category,
    condition: row.condition,
    grade: row.grade,
    isRefurbished: row.isRefurbished,
    batteryPct: row.batteryPct,
    listPrice: row.listPrice,
    coverPhotoUrl: cover ? publicUrl(cover) : null,
  };
}

const searchKey = (s: string) => slugify(s).replace(/-/g, "");

async function searchVariantIds(db: Db, q: string): Promise<string[]> {
  const key = searchKey(q);
  const variants = await db.productVariant.findMany({
    where: { isSerialized: true },
    select: { id: true, storage: true, ram: true, color: true, product: { select: { name: true, brand: true, category: true } } },
  });
  return variants
    .filter((v) =>
      searchKey(`${CATEGORY_LABEL[v.product.category]} ${v.product.brand} ${v.product.name} ${variantLabel(v)}`).includes(key),
    )
    .map((v) => v.id);
}

async function publicWhere(db: Db, filter: PublicDeviceFilter, now: Date): Promise<Prisma.DeviceWhereInput> {
  const and: Prisma.DeviceWhereInput[] = [availableForSaleWhere(now), { listPrice: { not: null } }];
  if (filter.q?.trim()) and.push({ variantId: { in: await searchVariantIds(db, filter.q) } });
  if (filter.category) and.push({ variant: { product: { category: filter.category } } });
  if (filter.condition) and.push({ condition: filter.condition });
  if (filter.grade) and.push({ grade: filter.grade });
  if (filter.minPrice !== undefined) and.push({ listPrice: { gte: filter.minPrice } });
  if (filter.maxPrice !== undefined) and.push({ listPrice: { lte: filter.maxPrice } });
  return { AND: and };
}

/** Đếm máy còn bán theo cùng bộ lọc với danh sách (vd. "Mua theo tầm giá"). */
export async function countPublicDevices(db: Db, filter: PublicDeviceFilter, now: Date = new Date()): Promise<number> {
  return db.device.count({ where: await publicWhere(db, filter, now) });
}

export async function listPublicDevices(
  db: Db,
  filter: PublicDeviceFilter,
  now: Date = new Date(),
): Promise<{ items: PublicDeviceCard[]; total: number }> {
  const where = await publicWhere(db, filter, now);

  const orderBy: Prisma.DeviceOrderByWithRelationInput[] =
    filter.sort === "price-asc"
      ? [{ listPrice: "asc" }]
      : filter.sort === "price-desc"
        ? [{ listPrice: "desc" }]
        : [{ listedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
  const page = Math.max(1, Math.floor(filter.page ?? 1));

  const [rows, total] = await Promise.all([
    db.device.findMany({ where, select: cardSelect, orderBy, skip: (page - 1) * SHOP_PAGE_SIZE, take: SHOP_PAGE_SIZE }),
    db.device.count({ where }),
  ]);
  return { items: rows.map(toCard), total };
}

function publicStatus(status: DeviceStatus, reservedUntil: Date | null, now: Date): PublicDeviceDetail["status"] | null {
  if (status === "LISTED") return "available";
  if (status === "RESERVED") return reservedUntil && reservedUntil > now ? "reserved" : "available";
  if (status === "SOLD" || status === "RETURNED") return "sold";
  return null; // chưa từng lên kệ / đang xử lý / loại bỏ
}

export async function getPublicDevice(db: Db, deviceId: string, now: Date = new Date()): Promise<PublicDeviceDetail | null> {
  const row = await db.device.findUnique({
    where: { id: deviceId },
    select: {
      ...cardSelect,
      status: true,
      reservedUntil: true,
      regionCode: true,
      inspections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { photoKeys: true, createdAt: true, templateVersion: true, checklist: true, replacedParts: true },
      },
    },
  });
  if (!row) return null;
  const status = publicStatus(row.status, row.reservedUntil, now);
  if (!status) return null;

  const report = row.inspections[0];
  return {
    ...toCard(row),
    status,
    brand: row.variant.product.brand,
    regionCode: row.regionCode,
    photos: (report?.photoKeys ?? []).map(publicUrl),
    report: report
      ? {
          createdAt: report.createdAt,
          templateVersion: report.templateVersion,
          checklist: report.checklist as unknown as ChecklistResult[],
          replacedParts: report.replacedParts,
        }
      : null,
  };
}

export type PublicAccessory = { id: string; name: string; label: string; price: bigint; inStock: number };

export async function listPublicAccessories(db: Db): Promise<PublicAccessory[]> {
  const rows = await db.productVariant.findMany({
    where: { isSerialized: false, archived: false, stockQty: { gt: 0 }, newPrice: { not: null }, product: { archived: false } },
    select: { id: true, storage: true, ram: true, color: true, newPrice: true, stockQty: true, product: { select: { name: true } } },
    orderBy: { product: { name: "asc" } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.product.name,
    label: variantLabel(r),
    price: r.newPrice!,
    inStock: r.stockQty,
  }));
}

/** Máy cùng loại, khác máy hiện tại — gợi ý khi máy đã bán. */
export async function listSimilarDevices(db: Db, category: ProductCategory, excludeId: string, now: Date = new Date()) {
  const rows = await db.device.findMany({
    where: { AND: [availableForSaleWhere(now), { listPrice: { not: null } }, { id: { not: excludeId } }, { variant: { product: { category } } }] },
    select: cardSelect,
    orderBy: { listedAt: { sort: "desc", nulls: "last" } },
    take: 4,
  });
  return rows.map(toCard);
}

export type SitemapEntry = { id: string; slug: string; updatedAt: Date };

export async function listSitemapDevices(db: Db, now: Date = new Date()): Promise<SitemapEntry[]> {
  const rows = await db.device.findMany({
    where: { AND: [availableForSaleWhere(now), { listPrice: { not: null } }] },
    select: { id: true, updatedAt: true, variant: { select: { storage: true, ram: true, color: true, product: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, slug: deviceSlug(r.variant.product.name, variantLabel(r.variant)), updatedAt: r.updatedAt }));
}
