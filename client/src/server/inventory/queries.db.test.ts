import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import type { SessionUser } from "../auth/session";
import { ForbiddenError } from "../auth/permissions";
import { createProduct, getProduct } from "../catalog/products";
import { countDevicesByTab, getDeviceDetail, getIdDocViewUrl, listDevices } from "./queries";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const NOW = new Date("2026-11-14T08:00:00Z");
const DAY = 86_400_000;
const DOC = "id-docs/2026/11/abcdef0123456789abcdef01.webp";

let owner: SessionUser;
let staff: SessionUser;
let variantId: string;

const asSession = (u: { id: string; name: string; phone: string; role: "OWNER" | "STAFF" }): SessionUser => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  role: u.role,
});

beforeEach(async () => {
  owner = asSession(await createUser({ role: "OWNER", name: "Chủ" }));
  staff = asSession(await createUser({ role: "STAFF", name: "NV" }));
  const p = await createProduct(db, {
    name: "iPhone 13",
    brand: "Apple",
    category: "PHONE",
    firstVariant: { storage: "128GB", color: "Xanh", isSerialized: true, referencePrice: 7_500_000n, newPrice: null },
  });
  variantId = (await getProduct(db, p.productId))!.variants[0].id;
});

async function device(over: Record<string, unknown> = {}) {
  const acq = await db.acquisition.create({
    data: {
      type: "TRADE_IN",
      sellerName: "Nguyễn Văn A",
      sellerPhone: "0912345678",
      sellerIdDocKey: DOC,
      originPledged: true,
      sellerConsent: true,
      totalPrice: 9_000_000n,
      createdById: owner.id,
    },
  });
  return db.device.create({
    data: {
      variantId,
      imei: "490154203237518",
      condition: "USED",
      costPrice: 9_000_000n,
      listPrice: 11_000_000n,
      status: "LISTED",
      listedAt: new Date(NOW.getTime() - 12 * DAY),
      acquisitionId: acq.id,
      events: { create: { toStatus: "INTAKE", actorId: owner.id, reason: "Nhập máy" } },
      ...over,
    },
  });
}

describe("listDevices", () => {
  it("never includes costPrice for STAFF, includes it for OWNER", async () => {
    await device();
    const forStaff = await listDevices(db, staff, { tab: "listed" }, NOW);
    expect(forStaff.total).toBe(1);
    expect("costPrice" in forStaff.items[0]).toBe(false);
    const forOwner = await listDevices(db, owner, { tab: "listed" }, NOW);
    expect(forOwner.items[0].costPrice).toBe(9_000_000n);
  });

  it("maps fields and inventory age", async () => {
    await device();
    const [item] = (await listDevices(db, owner, { tab: "listed" }, NOW)).items;
    expect(item).toMatchObject({
      imei: "490154203237518",
      productName: "iPhone 13",
      variantLabel: "128GB · Xanh",
      status: "LISTED",
      listPrice: 11_000_000n,
      ageDays: 12,
    });
  });

  it("treats an expired hold as listed, an active hold as reserved", async () => {
    await device({ status: "RESERVED", reservedUntil: new Date(NOW.getTime() - 1000) });
    expect((await listDevices(db, owner, { tab: "listed" }, NOW)).total).toBe(1);
    expect((await listDevices(db, owner, { tab: "reserved" }, NOW)).total).toBe(0);
    await db.device.updateMany({ data: { reservedUntil: new Date(NOW.getTime() + 60_000) } });
    expect((await listDevices(db, owner, { tab: "reserved" }, NOW)).total).toBe(1);
    expect((await listDevices(db, owner, { tab: "listed" }, NOW)).total).toBe(0);
  });

  it("puts INTAKE/INSPECTING/REFURBISHING/RETURNED under processing", async () => {
    await device({ status: "INTAKE", imei: "356938035643809" });
    await device({ status: "RETURNED" });
    expect((await listDevices(db, owner, { tab: "processing" }, NOW)).total).toBe(2);
  });

  it("searches by the last digits of IMEI or by model name", async () => {
    await device();
    expect((await listDevices(db, owner, { tab: "listed", q: "7518" }, NOW)).total).toBe(1);
    expect((await listDevices(db, owner, { tab: "listed", q: "iphone 13" }, NOW)).total).toBe(1);
    expect((await listDevices(db, owner, { tab: "listed", q: "galaxy" }, NOW)).total).toBe(0);
  });
});

describe("getDeviceDetail", () => {
  it("hides acquisition and cost from STAFF", async () => {
    const d = await device();
    const detail = await getDeviceDetail(db, staff, d.id, NOW);
    expect(detail).not.toBeNull();
    expect("acquisition" in detail!).toBe(false);
    expect("costPrice" in detail!).toBe(false);
    expect(detail!.events).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: "INTAKE", actorName: "Chủ", reason: "Nhập máy" }),
    ]);
  });

  it("shows acquisition to OWNER", async () => {
    const d = await device();
    const detail = await getDeviceDetail(db, owner, d.id, NOW);
    expect(detail?.acquisition).toMatchObject({
      type: "TRADE_IN",
      sellerName: "Nguyễn Văn A",
      sellerPhone: "0912345678",
      hasIdDoc: true,
      totalPrice: 9_000_000n,
    });
    expect(detail?.costPrice).toBe(9_000_000n);
  });

  it("returns null for an unknown id", async () => {
    expect(await getDeviceDetail(db, owner, "khong-co", NOW)).toBeNull();
  });
});

describe("getIdDocViewUrl", () => {
  it("is forbidden for STAFF", async () => {
    const d = await device();
    await expect(getIdDocViewUrl(db, staff, d.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns null when there is no document", async () => {
    const d = await db.device.create({ data: { variantId, imei: "356938035643809", condition: "NEW", costPrice: 1n } });
    expect(await getIdDocViewUrl(db, owner, d.id)).toBeNull();
  });

  it("signs a view url for OWNER", async () => {
    const d = await device();
    expect(await getIdDocViewUrl(db, owner, d.id)).toContain(DOC);
  });
});

describe("countDevicesByTab", () => {
  it("counts each tab with the same rules as listDevices", async () => {
    await device({ status: "INTAKE", imei: "356938035643809" });
    await device({ status: "RESERVED", reservedUntil: new Date(NOW.getTime() - 1000) });
    expect(await countDevicesByTab(db, NOW)).toEqual({ processing: 1, listed: 1, reserved: 0, sold: 0, rejected: 0 });
  });
});
