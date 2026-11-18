import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import {
  countPublicDevices,
  deviceSlug,
  getPublicDevice,
  listPublicAccessories,
  listPublicDevices,
  parseDeviceParam,
} from "./queries";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const NOW = new Date("2026-11-15T08:00:00Z");
const photo = (n: number) => `devices/2026/11/${String(n).padStart(24, "0")}.webp`;
let inspectorId: string;
let iphone: string;
let macbook: string;

async function variant(name: string, category: "PHONE" | "LAPTOP" | "ACCESSORY", attrs: Record<string, unknown> = {}) {
  const p = await db.product.create({
    data: {
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      brand: name.startsWith("Mac") || name.startsWith("iPhone") ? "Apple" : "OEM",
      category,
      variants: { create: { sku: `${name}-${Math.random()}`, ...attrs } },
    },
    include: { variants: true },
  });
  return p.variants[0].id;
}

async function listed(variantId: string, over: Record<string, unknown> = {}, photos = [photo(1), photo(2)]) {
  const d = await db.device.create({
    data: {
      variantId,
      imei: String(Math.floor(Math.random() * 1e15)).padStart(15, "0"),
      condition: "USED",
      grade: "A",
      batteryPct: 90,
      costPrice: 5_000_000n,
      listPrice: 9_000_000n,
      status: "LISTED",
      listedAt: NOW,
      ...over,
    },
  });
  await db.inspectionReport.create({
    data: {
      deviceId: d.id,
      inspectorId,
      templateVersion: 1,
      checklist: [{ key: "power", label: "Lên nguồn", result: "ok" }],
      photoKeys: photos,
      replacedParts: ["Pin"],
      accountLocked: false,
      dataWiped: true,
      passed: true,
    },
  });
  return d;
}

beforeEach(async () => {
  inspectorId = (await createUser({ role: "STAFF" })).id;
  iphone = await variant("iPhone 13", "PHONE", { storage: "128GB", color: "Xanh" });
  macbook = await variant("MacBook Air M2", "LAPTOP", { storage: "256GB", ram: "8GB" });
});

const SENSITIVE = ["costPrice", "acquisition", "acquisitionId", "inspectorId", "sellerIdDocKey", "imei", "serial", "version"];

describe("listPublicDevices", () => {
  it("returns only available devices with public fields", async () => {
    await listed(iphone);
    await listed(iphone, { status: "SOLD" });
    await listed(iphone, { status: "INSPECTING" });
    await listed(iphone, { status: "RESERVED", reservedUntil: new Date(NOW.getTime() + 60_000) });
    await listed(iphone, { status: "RESERVED", reservedUntil: new Date(NOW.getTime() - 60_000) });
    const { items, total } = await listPublicDevices(db, {}, NOW);
    expect(total).toBe(2);
    for (const item of items) for (const key of SENSITIVE) expect(item).not.toHaveProperty(key);
    expect(items[0]).toMatchObject({
      productName: "iPhone 13",
      variantLabel: "128GB · Xanh",
      category: "PHONE",
      condition: "USED",
      grade: "A",
      batteryPct: 90,
      listPrice: 9_000_000n,
      coverPhotoUrl: `http://localhost:8333/muaban-public/${photo(1)}`,
    });
    expect(items[0].slug).toBe("iphone-13-128gb-xanh");
  });

  it("filters by category, condition, grade and price range", async () => {
    await listed(iphone, { listPrice: 9_000_000n });
    await listed(iphone, { listPrice: 5_000_000n, grade: "C" });
    await listed(macbook, { listPrice: 15_000_000n, condition: "NEW", grade: null });
    expect((await listPublicDevices(db, { category: "LAPTOP" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { condition: "NEW" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { grade: "C" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { minPrice: 6_000_000n, maxPrice: 10_000_000n }, NOW)).total).toBe(1);
  });

  it("searches without accents and spaces", async () => {
    await listed(iphone);
    await listed(macbook);
    expect((await listPublicDevices(db, { q: "iphone13" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { q: "macbook air" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { q: "dien thoai" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { q: "điện thoại" }, NOW)).total).toBe(1);
    expect((await listPublicDevices(db, { q: "galaxy" }, NOW)).total).toBe(0);
  });

  it("sorts by price", async () => {
    await listed(iphone, { listPrice: 9_000_000n });
    await listed(macbook, { listPrice: 15_000_000n });
    await listed(iphone, { listPrice: 5_000_000n });
    const asc = await listPublicDevices(db, { sort: "price-asc" }, NOW);
    expect(asc.items.map((i) => i.listPrice)).toEqual([5_000_000n, 9_000_000n, 15_000_000n]);
    const desc = await listPublicDevices(db, { sort: "price-desc" }, NOW);
    expect(desc.items[0].listPrice).toBe(15_000_000n);
  });
});

describe("getPublicDevice", () => {
  it("returns the passport without internal fields", async () => {
    const d = await listed(iphone, { regionCode: "VN/A", isRefurbished: true });
    const p = await getPublicDevice(db, d.id, NOW);
    expect(p).toMatchObject({ status: "available", regionCode: "VN/A", isRefurbished: true, brand: "Apple" });
    expect(p?.photos).toEqual([photo(1), photo(2)].map((k) => `http://localhost:8333/muaban-public/${k}`));
    expect(p?.report?.replacedParts).toEqual(["Pin"]);
    expect(p?.report?.checklist).toEqual([{ key: "power", label: "Lên nguồn", result: "ok" }]);
    for (const key of SENSITIVE) expect(p).not.toHaveProperty(key);
    expect(p?.report).not.toHaveProperty("inspectorId");
  });

  it("reports reserved and sold states", async () => {
    const r = await listed(iphone, { status: "RESERVED", reservedUntil: new Date(NOW.getTime() + 60_000) });
    expect((await getPublicDevice(db, r.id, NOW))?.status).toBe("reserved");
    const s = await listed(iphone, { status: "SOLD" });
    expect((await getPublicDevice(db, s.id, NOW))?.status).toBe("sold");
  });

  it("hides devices that were never put on sale", async () => {
    const d = await db.device.create({ data: { variantId: iphone, imei: "490154203237518", condition: "USED", costPrice: 1n, status: "INSPECTING" } });
    expect(await getPublicDevice(db, d.id, NOW)).toBeNull();
    const rejected = await listed(iphone, { status: "REJECTED" });
    expect(await getPublicDevice(db, rejected.id, NOW)).toBeNull();
    expect(await getPublicDevice(db, "khong-co", NOW)).toBeNull();
  });
});

describe("slugs", () => {
  it("builds and parses device params", () => {
    expect(deviceSlug("MacBook Air M2", "8GB/256GB")).toBe("macbook-air-m2-8gb-256gb");
    expect(parseDeviceParam("iphone-13-128gb-xanh-cm3abc123")).toBe("cm3abc123");
    expect(parseDeviceParam("cm3abc123")).toBe("cm3abc123");
  });
});

describe("listPublicAccessories", () => {
  it("lists in-stock, priced, visible accessories", async () => {
    await variant("Củ sạc 20W", "ACCESSORY", { isSerialized: false, stockQty: 3, newPrice: 250_000n });
    await variant("Cáp hết hàng", "ACCESSORY", { isSerialized: false, stockQty: 0, newPrice: 100_000n });
    await variant("Ốp chưa giá", "ACCESSORY", { isSerialized: false, stockQty: 5, newPrice: null });
    const items = await listPublicAccessories(db);
    expect(items).toEqual([expect.objectContaining({ name: "Củ sạc 20W", price: 250_000n, inStock: 3 })]);
  });
});

describe("countPublicDevices", () => {
  it("counts available devices with the same filters as the list", async () => {
    await listed(iphone, { listPrice: 4_500_000n });
    await listed(iphone, { listPrice: 9_000_000n });
    await listed(macbook, { listPrice: 15_000_000n });
    await listed(macbook, { listPrice: 25_000_000n, status: "SOLD" });
    expect(await countPublicDevices(db, {}, NOW)).toBe(3);
    expect(await countPublicDevices(db, { maxPrice: 5_000_000n }, NOW)).toBe(1);
    expect(await countPublicDevices(db, { minPrice: 5_000_000n, maxPrice: 10_000_000n }, NOW)).toBe(1);
    expect(await countPublicDevices(db, { minPrice: 20_000_000n }, NOW)).toBe(0);
    expect(await countPublicDevices(db, { category: "LAPTOP" }, NOW)).toBe(1);
  });
});
