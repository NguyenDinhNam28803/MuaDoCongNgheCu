// Đọc dữ liệu website công khai có cache (Cache Components).
// Admin đổi máy → updateTag("devices"); đổi thông tin shop → updateTag("shop").
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Condition, Grade, ProductCategory } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import {
  countPublicDevices,
  getPublicDevice,
  listPublicAccessories,
  listPublicDevices,
  listSimilarDevices,
  listSitemapDevices,
} from "@/server/shop/queries";
import { getShopInfo } from "@/server/shop/settings";

export async function shopInfo() {
  "use cache";
  cacheTag("shop");
  cacheLife("hours");
  return getShopInfo(prisma);
}

export async function homeData() {
  "use cache";
  cacheTag("devices");
  cacheLife("minutes");
  const M = 1_000_000n;
  const buckets = [
    { label: "Dưới 5 triệu", href: "/may?max=5tr", filter: { maxPrice: 5n * M } },
    { label: "5 – 10 triệu", href: "/may?min=5tr&max=10tr", filter: { minPrice: 5n * M, maxPrice: 10n * M } },
    { label: "10 – 20 triệu", href: "/may?min=10tr&max=20tr", filter: { minPrice: 10n * M, maxPrice: 20n * M } },
    { label: "Trên 20 triệu", href: "/may?min=20tr", filter: { minPrice: 20n * M } },
  ];
  const [latest, accessories, counts] = await Promise.all([
    listPublicDevices(prisma, { sort: "newest", page: 1 }),
    listPublicAccessories(prisma),
    Promise.all(buckets.map((b) => countPublicDevices(prisma, b.filter))),
  ]);
  return {
    latest: latest.items.slice(0, 5),
    totalAvailable: latest.total,
    accessories: accessories.slice(0, 8),
    budgets: buckets.map((b, i) => ({ label: b.label, href: b.href, count: counts[i] })),
  };
}

/** Tham số dạng chuỗi để làm khóa cache (giá truyền dưới dạng chuỗi số). */
export type DeviceListParams = {
  q?: string;
  category?: ProductCategory;
  condition?: Condition;
  grade?: Grade;
  minPrice?: string;
  maxPrice?: string;
  sort?: "newest" | "price-asc" | "price-desc";
  page?: number;
};

export async function deviceList(params: DeviceListParams) {
  "use cache";
  cacheTag("devices");
  cacheLife("minutes");
  return listPublicDevices(prisma, {
    ...params,
    minPrice: params.minPrice ? BigInt(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? BigInt(params.maxPrice) : undefined,
  });
}

export async function deviceDetail(id: string) {
  "use cache";
  cacheTag("devices");
  cacheLife("minutes");
  return getPublicDevice(prisma, id);
}

export async function similarDevices(category: ProductCategory, excludeId: string) {
  "use cache";
  cacheTag("devices");
  cacheLife("minutes");
  return listSimilarDevices(prisma, category, excludeId);
}

export async function accessoryList() {
  "use cache";
  cacheTag("devices");
  cacheLife("minutes");
  return listPublicAccessories(prisma);
}

export async function sitemapDevices() {
  "use cache";
  cacheTag("devices");
  cacheLife("hours");
  return listSitemapDevices(prisma);
}
