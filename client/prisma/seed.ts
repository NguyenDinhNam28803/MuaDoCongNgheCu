// Seed dữ liệu khởi đầu: tài khoản chủ shop, danh sách model phổ biến, cấu hình.
// Chạy: pnpm db:seed (idempotent — chạy lại không tạo trùng).
// Giá tham chiếu chỉ là số minh họa; chủ shop cập nhật lại trong trang quản trị.
import "dotenv/config";
import { createPrismaClient } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import type { ProductCategory } from "../src/generated/prisma/enums";

const db = createPrismaClient();

interface SeedVariant {
  sku: string;
  storage?: string;
  ram?: string;
  color?: string;
  referencePrice?: number; // triệu VND
  newPrice?: number; // triệu VND
  isSerialized?: boolean;
}

interface SeedProduct {
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  variants: SeedVariant[];
}

const M = (millions?: number) => (millions === undefined ? undefined : BigInt(Math.round(millions * 1_000_000)));

const PRODUCTS: SeedProduct[] = [
  {
    slug: "iphone-13",
    name: "iPhone 13",
    brand: "Apple",
    category: "PHONE",
    variants: [
      { sku: "IP13-128", storage: "128GB", referencePrice: 7.5 },
      { sku: "IP13-256", storage: "256GB", referencePrice: 8.5 },
    ],
  },
  {
    slug: "iphone-14",
    name: "iPhone 14",
    brand: "Apple",
    category: "PHONE",
    variants: [
      { sku: "IP14-128", storage: "128GB", referencePrice: 9.5 },
      { sku: "IP14-256", storage: "256GB", referencePrice: 10.5 },
    ],
  },
  {
    slug: "iphone-15-pro",
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "PHONE",
    variants: [
      { sku: "IP15P-128", storage: "128GB", referencePrice: 15 },
      { sku: "IP15P-256", storage: "256GB", referencePrice: 16.5 },
    ],
  },
  {
    slug: "iphone-16",
    name: "iPhone 16",
    brand: "Apple",
    category: "PHONE",
    variants: [{ sku: "IP16-128", storage: "128GB", referencePrice: 14, newPrice: 19.5 }],
  },
  {
    slug: "samsung-galaxy-s24",
    name: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "PHONE",
    variants: [{ sku: "SS-S24-256", storage: "256GB", referencePrice: 9 }],
  },
  {
    slug: "macbook-air-m2",
    name: "MacBook Air M2 13\"",
    brand: "Apple",
    category: "LAPTOP",
    variants: [{ sku: "MBA-M2-8-256", ram: "8GB", storage: "256GB", referencePrice: 13 }],
  },
  {
    slug: "macbook-air-m3",
    name: "MacBook Air M3 13\"",
    brand: "Apple",
    category: "LAPTOP",
    variants: [{ sku: "MBA-M3-16-256", ram: "16GB", storage: "256GB", referencePrice: 19 }],
  },
  {
    slug: "cuong-luc-iphone",
    name: "Kính cường lực iPhone",
    brand: "OEM",
    category: "ACCESSORY",
    variants: [{ sku: "ACC-CL-IP", isSerialized: false, newPrice: 0.15 }],
  },
  {
    slug: "cu-sac-20w",
    name: "Củ sạc nhanh 20W",
    brand: "OEM",
    category: "ACCESSORY",
    variants: [{ sku: "ACC-SAC-20W", isSerialized: false, newPrice: 0.25 }],
  },
];

async function main() {
  const ownerPhone = process.env.SEED_OWNER_PHONE ?? "0900000000";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "doimatkhau";

  await db.user.upsert({
    where: { phone: ownerPhone },
    update: {},
    create: { name: "Chủ cửa hàng", phone: ownerPhone, passwordHash: await hashPassword(ownerPassword), role: "OWNER" },
  });

  for (const p of PRODUCTS) {
    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: { name: p.name, brand: p.brand, category: p.category },
      create: { slug: p.slug, name: p.name, brand: p.brand, category: p.category },
    });
    for (const v of p.variants) {
      const data = {
        storage: v.storage,
        ram: v.ram,
        color: v.color,
        isSerialized: v.isSerialized ?? true,
        referencePrice: M(v.referencePrice),
        newPrice: M(v.newPrice),
      };
      await db.productVariant.upsert({
        where: { sku: v.sku },
        update: data,
        create: { ...data, sku: v.sku, productId: product.id },
      });
    }
  }

  await db.shopSetting.upsert({
    where: { key: "reservation.holdMinutes" },
    update: {},
    create: { key: "reservation.holdMinutes", value: 120 },
  });

  console.log(`Seed xong: ${PRODUCTS.length} model, tài khoản chủ shop ${ownerPhone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
