import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import type { SessionUser } from "../auth/session";
import { ForbiddenError } from "../auth/permissions";
import { createProduct, getProduct } from "../catalog/products";
import { DeviceConflictError } from "../devices/errors";
import { InspectionRuleError } from "./errors";
import { finishRefurbish, getLatestReport, startInspection, submitInspection, updateListPrice, type InspectionInput } from "./service";
import { checklistFor } from "./templates";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const photo = (n: number) => `devices/2026/11/${String(n).padStart(24, "0")}.webp`;
const PHOTOS = [1, 2, 3, 4].map(photo);
const deps = { objectExists: async () => true };

let staff: SessionUser;
let owner: SessionUser;
let variantId: string;

const session = (u: { id: string; name: string; phone: string; role: "OWNER" | "STAFF" }): SessionUser => ({
  id: u.id,
  name: u.name,
  phone: u.phone,
  role: u.role,
});

beforeEach(async () => {
  staff = session(await createUser({ role: "STAFF", name: "NV kiểm định" }));
  owner = session(await createUser({ role: "OWNER", name: "Chủ" }));
  const p = await createProduct(db, {
    name: "iPhone 13",
    brand: "Apple",
    category: "PHONE",
    firstVariant: { storage: "128GB", isSerialized: true, referencePrice: 7_500_000n, newPrice: null },
  });
  variantId = (await getProduct(db, p.productId))!.variants[0].id;
});

async function device(status: "INTAKE" | "INSPECTING" | "RETURNED" | "LISTED" | "REFURBISHING" | "SOLD" = "INSPECTING", condition: "NEW" | "USED" = "USED") {
  return db.device.create({ data: { variantId, imei: "490154203237518", condition, costPrice: 6_000_000n, status } });
}

const allOk = () => checklistFor("PHONE").map((i) => ({ key: i.key, label: i.label, result: "ok" as const }));

const input = (over: Partial<InspectionInput> = {}): InspectionInput => ({
  checklist: allOk(),
  batteryPct: 88,
  grade: "A",
  replacedParts: [],
  regionCode: "VN/A",
  photoKeys: PHOTOS,
  accountLocked: false,
  dataWiped: true,
  isRefurbished: false,
  notes: null,
  decision: "LIST",
  listPrice: 9_000_000n,
  ...over,
});

const err = (m: string) => new InspectionRuleError(m);

describe("submitInspection", () => {
  it("lists a clean used device and stores an immutable report", async () => {
    const d = await device();
    const r = await submitInspection(db, staff, d.id, input({ replacedParts: ["Pin"] }), deps);
    expect(r.status).toBe("LISTED");
    const after = await db.device.findUniqueOrThrow({ where: { id: d.id }, include: { inspections: true, events: true } });
    expect(after).toMatchObject({ status: "LISTED", grade: "A", batteryPct: 88, listPrice: 9_000_000n, regionCode: "VN/A" });
    expect(after.inspections).toHaveLength(1);
    expect(after.inspections[0]).toMatchObject({
      inspectorId: staff.id,
      templateVersion: 1,
      passed: true,
      accountLocked: false,
      dataWiped: true,
      replacedParts: ["Pin"],
      photoKeys: PHOTOS,
    });
    expect(after.events).toHaveLength(1);
  });

  it("blocks listing an account-locked device; it stays in INSPECTING", async () => {
    const d = await device();
    await expect(submitInspection(db, staff, d.id, input({ accountLocked: true }), deps)).rejects.toThrow(
      err("Máy còn khóa tài khoản: chỉ có thể loại bỏ"),
    );
    await expect(submitInspection(db, staff, d.id, input({ accountLocked: true, decision: "REFURBISH" }), deps)).rejects.toThrow(
      err("Máy còn khóa tài khoản: chỉ có thể loại bỏ"),
    );
    expect((await db.device.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("INSPECTING");
    expect(await db.inspectionReport.count()).toBe(0);
  });

  it.each([
    ["data not wiped", { dataWiped: false }, "Phải xóa dữ liệu máy trước khi lên kệ"],
    ["3 photos", { photoKeys: PHOTOS.slice(0, 3) }, "Máy đã qua sử dụng cần 4–6 ảnh"],
    ["7 photos", { photoKeys: [1, 2, 3, 4, 5, 6, 7].map(photo) }, "Máy đã qua sử dụng cần 4–6 ảnh"],
    ["foreign photo key", { photoKeys: [...PHOTOS.slice(0, 3), "id-docs/2026/11/000000000000000000000001.webp"] }, "Ảnh không hợp lệ"],
    ["missing grade", { grade: null }, "Chọn hạng máy"],
    ["battery 101", { batteryPct: 101 }, "% pin không hợp lệ"],
    ["missing checklist item", { checklist: allOk().slice(1) }, "Checklist chưa đủ"],
    ["unknown checklist key", { checklist: [...allOk().slice(1), { key: "x", label: "x", result: "ok" as const }] }, "Checklist chưa đủ"],
    ["no price", { listPrice: null }, "Nhập giá bán"],
    ["zero price", { listPrice: 0n }, "Nhập giá bán"],
  ])("rejects %s", async (_, over, message) => {
    const d = await device();
    await expect(submitInspection(db, staff, d.id, input(over), deps)).rejects.toThrow(err(message));
    expect(await db.inspectionReport.count()).toBe(0);
  });

  it("rejects photos that never finished uploading", async () => {
    const d = await device();
    await expect(submitInspection(db, staff, d.id, input(), { objectExists: async () => false })).rejects.toThrow(
      err("Có ảnh chưa tải lên xong, vui lòng chụp lại"),
    );
  });

  it("new devices need 1–6 photos and no grade", async () => {
    const d = await device("INSPECTING", "NEW");
    const r = await submitInspection(db, staff, d.id, input({ photoKeys: [photo(1)], grade: null, batteryPct: 100 }), deps);
    expect(r.status).toBe("LISTED");
    expect((await db.device.findUniqueOrThrow({ where: { id: d.id } })).grade).toBeNull();
  });

  it("reject needs a reason and works even when locked", async () => {
    const d = await device();
    await expect(
      submitInspection(db, staff, d.id, input({ decision: "REJECT", accountLocked: true, listPrice: null }), deps),
    ).rejects.toThrow(err("Ghi lý do loại bỏ"));
    const r = await submitInspection(
      db,
      staff,
      d.id,
      input({ decision: "REJECT", accountLocked: true, listPrice: null, notes: "Khóa iCloud", grade: null, photoKeys: [] }),
      deps,
    );
    expect(r.status).toBe("REJECTED");
    expect((await db.inspectionReport.findFirstOrThrow()).passed).toBe(false);
  });

  it("refurbish moves to REFURBISHING with a passing report", async () => {
    const d = await device();
    const r = await submitInspection(db, staff, d.id, input({ decision: "REFURBISH", listPrice: null }), deps);
    expect(r.status).toBe("REFURBISHING");
    expect((await db.inspectionReport.findFirstOrThrow()).passed).toBe(true);
  });

  it("refuses a device that is not being inspected", async () => {
    const d = await device("LISTED");
    await expect(submitInspection(db, staff, d.id, input(), deps)).rejects.toBeInstanceOf(DeviceConflictError);
  });

  it("two concurrent submissions: exactly one report", async () => {
    const d = await device();
    const results = await Promise.allSettled([
      submitInspection(db, staff, d.id, input(), deps),
      submitInspection(db, owner, d.id, input(), deps),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.inspectionReport.count()).toBe(1);
  });
});

describe("startInspection", () => {
  it("moves INTAKE and RETURNED devices into INSPECTING", async () => {
    const a = await device("INTAKE");
    await startInspection(db, staff, a.id);
    expect((await db.device.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("INSPECTING");
    await db.device.update({ where: { id: a.id }, data: { status: "RETURNED" } });
    await startInspection(db, staff, a.id);
    expect((await db.device.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("INSPECTING");
  });

  it("refuses a listed device", async () => {
    const d = await device("LISTED");
    await expect(startInspection(db, staff, d.id)).rejects.toThrow(err("Máy không ở trạng thái chờ kiểm định"));
  });
});

describe("finishRefurbish", () => {
  it("records the refurbish cost, marks refurbished and lists the device", async () => {
    const d = await device();
    await submitInspection(db, staff, d.id, input({ decision: "REFURBISH", listPrice: null }), deps);
    await finishRefurbish(db, staff, d.id, { cost: 800_000n, note: "Thay pin", listPrice: 9_500_000n, batteryPct: 100, replacedParts: ["Pin"] });
    const after = await db.device.findUniqueOrThrow({ where: { id: d.id }, include: { costs: true } });
    expect(after).toMatchObject({ status: "LISTED", isRefurbished: true, listPrice: 9_500_000n, batteryPct: 100 });
    expect(after.costs).toEqual([expect.objectContaining({ type: "REFURBISH", amount: 800_000n, note: "Thay pin" })]);
  });

  it("needs a positive list price", async () => {
    const d = await device("REFURBISHING");
    await expect(finishRefurbish(db, staff, d.id, { cost: 0n, note: null, listPrice: 0n })).rejects.toThrow(err("Nhập giá bán"));
  });
});

describe("updateListPrice", () => {
  it("is owner-only", async () => {
    const d = await device("LISTED");
    await expect(updateListPrice(db, staff, d.id, 8_000_000n)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("changes the price of a listed device and logs it", async () => {
    const d = await device("LISTED");
    await db.device.update({ where: { id: d.id }, data: { listPrice: 9_000_000n } });
    await updateListPrice(db, owner, d.id, 8_500_000n);
    const after = await db.device.findUniqueOrThrow({ where: { id: d.id }, include: { events: true } });
    expect(after.listPrice).toBe(8_500_000n);
    expect(after.events[0]).toMatchObject({ fromStatus: "LISTED", toStatus: "LISTED", reason: "Đổi giá: 9.000.000 ₫ → 8.500.000 ₫" });
  });

  it("rejects invalid prices and devices not for sale", async () => {
    const d = await device("SOLD");
    await expect(updateListPrice(db, owner, d.id, 0n)).rejects.toThrow(err("Giá bán không hợp lệ"));
    await expect(updateListPrice(db, owner, d.id, 1n)).rejects.toThrow(err("Chỉ đổi giá máy đang bán"));
  });
});

describe("getLatestReport", () => {
  it("returns the newest report without internal fields", async () => {
    const d = await device();
    await submitInspection(db, staff, d.id, input(), deps);
    const r = await getLatestReport(db, d.id);
    expect(r).toMatchObject({ grade: "A", batteryPct: 88, photoKeys: PHOTOS, templateVersion: 1 });
    expect(r).not.toHaveProperty("inspectorId");
    expect(r?.checklist).toHaveLength(14);
  });
});
