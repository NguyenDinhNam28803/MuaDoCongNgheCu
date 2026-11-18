// Test tích hợp với Postgres thật (pnpm test:db). Dùng DB muaban_test, bị reset mỗi lần chạy.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "../../../test/db";
import { DeviceConflictError, InspectionGateError } from "./errors";
import {
  availableForSaleWhere,
  releaseExpiredReservations,
  reserveDevice,
  transition,
  transitionInTx,
} from "./service";

afterAll(() => db.$disconnect());

let userId: string;
let variantId: string;

beforeEach(async () => {
  await resetDb();

  userId = (await db.user.create({ data: { name: "Chủ shop", phone: "0900000000", passwordHash: "x", role: "OWNER" } })).id;
  const product = await db.product.create({
    data: { slug: "iphone-15", name: "iPhone 15", brand: "Apple", category: "PHONE" },
  });
  variantId = (await db.productVariant.create({ data: { productId: product.id, sku: "IP15-128-BLK", storage: "128GB" } })).id;
});

async function makeDevice(status: "LISTED" | "INSPECTING" = "LISTED") {
  return db.device.create({
    data: { imei: `35${Math.random().toString().slice(2, 15)}`, variantId, condition: "USED", grade: "A", status, costPrice: 10_000_000n },
  });
}

describe("reserveDevice", () => {
  it("only one of two concurrent reservations wins (chống bán trùng)", async () => {
    const d = await makeDevice();
    const results = await Promise.allSettled([
      reserveDevice(db, { deviceId: d.id, holdMinutes: 120 }),
      reserveDevice(db, { deviceId: d.id, holdMinutes: 120 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(DeviceConflictError);
    expect(await db.deviceEvent.count({ where: { deviceId: d.id } })).toBe(1);
  });

  it("an expired hold is treated as available (lazy expiry)", async () => {
    const d = await makeDevice();
    const t0 = new Date("2026-11-13T08:00:00Z");
    await reserveDevice(db, { deviceId: d.id, holdMinutes: 60, now: t0 });

    const later = new Date("2026-11-13T09:30:00Z");
    expect(await db.device.count({ where: { id: d.id, ...availableForSaleWhere(later) } })).toBe(1);

    // Bán tại quầy dù cron chưa dọn
    await transition(db, { deviceId: d.id, from: "LISTED", to: "SOLD", now: later, actorId: userId });
    const sold = await db.device.findUniqueOrThrow({ where: { id: d.id } });
    expect(sold.status).toBe("SOLD");
    expect(sold.reservedUntil).toBeNull();
  });

  it("an active hold blocks a counter sale", async () => {
    const d = await makeDevice();
    await reserveDevice(db, { deviceId: d.id, holdMinutes: 120 });
    await expect(transition(db, { deviceId: d.id, from: "LISTED", to: "SOLD" })).rejects.toBeInstanceOf(DeviceConflictError);
  });
});

describe("releaseExpiredReservations", () => {
  it("moves expired holds back to LISTED and logs an event", async () => {
    const d = await makeDevice();
    await reserveDevice(db, { deviceId: d.id, holdMinutes: 1, now: new Date("2026-11-13T08:00:00Z") });
    expect(await releaseExpiredReservations(db, new Date("2026-11-13T09:00:00Z"))).toBe(1);
    expect((await db.device.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("LISTED");
  });
});

describe("transition", () => {
  it("rejects a stale version (khóa lạc quan)", async () => {
    const d = await makeDevice();
    await expect(
      transition(db, { deviceId: d.id, from: "LISTED", to: "SOLD", expectedVersion: d.version + 1 }),
    ).rejects.toBeInstanceOf(DeviceConflictError);
  });

  it("blocks listing a device whose latest inspection is account-locked", async () => {
    const d = await makeDevice("INSPECTING");
    await db.inspectionReport.create({
      data: {
        deviceId: d.id,
        inspectorId: userId,
        templateVersion: 1,
        checklist: [],
        accountLocked: true,
        dataWiped: true,
        passed: true,
      },
    });
    await expect(transition(db, { deviceId: d.id, from: "INSPECTING", to: "LISTED" })).rejects.toBeInstanceOf(
      InspectionGateError,
    );
    expect((await db.device.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("INSPECTING");
  });

  it("lists a device with a clean inspection and writes an event", async () => {
    const d = await makeDevice("INSPECTING");
    await db.inspectionReport.create({
      data: { deviceId: d.id, inspectorId: userId, templateVersion: 1, checklist: [], accountLocked: false, dataWiped: true, passed: true },
    });
    await transition(db, { deviceId: d.id, from: "INSPECTING", to: "LISTED", actorId: userId });
    const listed = await db.device.findUniqueOrThrow({ where: { id: d.id }, include: { events: true } });
    expect(listed.status).toBe("LISTED");
    expect(listed.listedAt).not.toBeNull();
    expect(listed.version).toBe(1);
    expect(listed.events).toHaveLength(1);
  });
});

describe("transitionInTx", () => {
  it("buys back a sold device inside an outer transaction with new data", async () => {
    const d = await db.device.create({
      data: { imei: "490154203237518", variantId, condition: "USED", grade: "A", status: "SOLD", costPrice: 10_000_000n },
    });
    await db.$transaction((tx) =>
      transitionInTx(tx, {
        deviceId: d.id,
        from: "SOLD",
        to: "INTAKE",
        actorId: userId,
        data: { costPrice: 9_000_000n, grade: null },
      }),
    );
    const after = await db.device.findUniqueOrThrow({ where: { id: d.id }, include: { events: true } });
    expect(after.status).toBe("INTAKE");
    expect(after.costPrice).toBe(9_000_000n);
    expect(after.grade).toBeNull();
    expect(after.version).toBe(d.version + 1);
    expect(after.events).toHaveLength(1);
  });

  it("rolls back the outer transaction when the device moved", async () => {
    const d = await makeDevice("LISTED");
    await expect(
      db.$transaction(async (tx) => {
        await tx.deviceCost.create({ data: { deviceId: d.id, type: "OTHER", amount: 1n } });
        await transitionInTx(tx, { deviceId: d.id, from: "SOLD", to: "INTAKE" });
      }),
    ).rejects.toBeInstanceOf(DeviceConflictError);
    expect(await db.deviceCost.count()).toBe(0);
  });
});
