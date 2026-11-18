import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import type { SessionUser } from "../auth/session";
import { createProduct, getProduct } from "../catalog/products";
import { IntakeRuleError } from "./errors";
import { checkIdentifier, intakeDevices, type IntakeInput } from "./intake";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const IMEI = "490154203237518";
const IMEI2 = "356938035643809";
const DOC = "id-docs/2026/11/abcdef0123456789abcdef01.webp";
const exists = { objectExists: async () => true };

let actor: SessionUser;
let variantId: string;
let accessoryId: string;

beforeEach(async () => {
  const u = await createUser({ role: "STAFF", name: "Nhân viên" });
  actor = { id: u.id, name: u.name, phone: u.phone, role: u.role };
  const p = await createProduct(db, {
    name: "iPhone 13",
    brand: "Apple",
    category: "PHONE",
    firstVariant: { storage: "128GB", isSerialized: true, referencePrice: 7_500_000n, newPrice: null },
  });
  variantId = (await getProduct(db, p.productId))!.variants[0].id;
  const a = await createProduct(db, {
    name: "Củ sạc",
    brand: "OEM",
    category: "ACCESSORY",
    firstVariant: { isSerialized: false, referencePrice: null, newPrice: 1n },
  });
  accessoryId = (await getProduct(db, a.productId))!.variants[0].id;
});

const tradeIn = (over: Partial<IntakeInput> = {}): IntakeInput => ({
  type: "TRADE_IN",
  seller: { name: "Nguyễn Văn A", phone: "+84 912 345 678", idDocKey: DOC, originPledged: true, consent: true },
  devices: [{ variantId, imei: IMEI, condition: "USED", costPrice: 7_000_000n }],
  ...over,
});

const err = (message: string) => new IntakeRuleError(message);

describe("intakeDevices — trade-in", () => {
  it("creates acquisition, device in INTAKE and an event", async () => {
    const r = await intakeDevices(db, actor, tradeIn(), exists);
    const acq = await db.acquisition.findUniqueOrThrow({ where: { id: r.acquisitionId } });
    expect(acq).toMatchObject({
      type: "TRADE_IN",
      sellerName: "Nguyễn Văn A",
      sellerPhone: "0912345678",
      sellerIdDocKey: DOC,
      originPledged: true,
      sellerConsent: true,
      totalPrice: 7_000_000n,
      createdById: actor.id,
    });
    const device = await db.device.findUniqueOrThrow({ where: { id: r.deviceIds[0] }, include: { events: true } });
    expect(device).toMatchObject({ status: "INTAKE", condition: "USED", imei: IMEI, costPrice: 7_000_000n, acquisitionId: acq.id });
    expect(device.events).toEqual([expect.objectContaining({ fromStatus: null, toStatus: "INTAKE", actorId: actor.id })]);
    expect(r.warnings).toEqual([]);
  });

  it.each([
    ["consent", { consent: false }, "Người bán phải đồng ý cho lưu thông tin"],
    ["pledge", { originPledged: false }, "Người bán phải cam kết nguồn gốc máy"],
    ["phone", { phone: "123" }, "Số điện thoại người bán không hợp lệ"],
    ["name", { name: " " }, "Vui lòng nhập tên người bán"],
    ["doc kind", { idDocKey: "devices/2026/11/abcdef0123456789abcdef01.webp" }, "Ảnh giấy tờ không hợp lệ"],
    ["doc photo", { idDocKey: "" }, "Vui lòng chụp ảnh giấy tờ người bán"],
  ])("rejects missing/invalid %s", async (_, sellerOver, message) => {
    const input = tradeIn();
    input.seller = { ...input.seller!, ...sellerOver };
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(err(message));
    expect(await db.acquisition.count()).toBe(0);
  });

  it("rejects a trade-in without seller info", async () => {
    await expect(intakeDevices(db, actor, tradeIn({ seller: undefined }), exists)).rejects.toThrow(
      err("Thu từ khách lẻ cần thông tin người bán"),
    );
  });

  it("rejects when the id photo never finished uploading", async () => {
    await expect(intakeDevices(db, actor, tradeIn(), { objectExists: async () => false })).rejects.toThrow(
      err("Ảnh giấy tờ chưa tải lên xong, vui lòng chụp lại"),
    );
  });
});

describe("intakeDevices — device rules", () => {
  it("needs an IMEI or serial", async () => {
    const input = tradeIn({ devices: [{ variantId, condition: "USED", costPrice: 1n }] });
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(err("Máy thứ 1: cần IMEI hoặc serial"));
  });

  it("rejects an IMEI failing Luhn", async () => {
    const input = tradeIn({ devices: [{ variantId, imei: "490154203237519", condition: "USED", costPrice: 1n }] });
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(err("Máy thứ 1: IMEI không hợp lệ"));
  });

  it("rejects duplicate IMEIs in one slip", async () => {
    const d = { variantId, imei: IMEI, condition: "USED" as const, costPrice: 1n };
    const input: IntakeInput = { type: "WHOLESALE", sourceName: "Mối buôn A", devices: [d, { ...d }] };
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(err("IMEI bị lặp trong phiếu"));
  });

  it("requires NEW condition for distributor stock", async () => {
    const input: IntakeInput = {
      type: "NEW_STOCK",
      sourceName: "NPP",
      devices: [{ variantId, imei: IMEI, condition: "USED", costPrice: 1n }],
    };
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(
      err("Hàng nhập từ nhà phân phối phải là máy mới"),
    );
  });

  it("rejects accessories and archived variants", async () => {
    const acc = tradeIn({ devices: [{ variantId: accessoryId, imei: IMEI, condition: "USED", costPrice: 1n }] });
    await expect(intakeDevices(db, actor, acc, exists)).rejects.toThrow(err("Máy thứ 1: model không hợp lệ"));
    await db.productVariant.update({ where: { id: variantId }, data: { archived: true } });
    await expect(intakeDevices(db, actor, tradeIn(), exists)).rejects.toThrow(err("Máy thứ 1: model không hợp lệ"));
  });

  it("rejects an IMEI already in stock and a previously rejected device", async () => {
    const d = await db.device.create({ data: { variantId, imei: IMEI, condition: "USED", costPrice: 1n, status: "LISTED" } });
    await expect(intakeDevices(db, actor, tradeIn(), exists)).rejects.toThrow(err("Máy thứ 1: IMEI đang có trong kho"));
    await db.device.update({ where: { id: d.id }, data: { status: "REJECTED" } });
    await expect(intakeDevices(db, actor, tradeIn(), exists)).rejects.toThrow(
      err("Máy thứ 1: máy này từng bị loại (khóa tài khoản/không đạt), không nhận"),
    );
  });

  it("rolls back everything when the second device is invalid", async () => {
    const input: IntakeInput = {
      type: "WHOLESALE",
      sourceName: "Mối buôn A",
      devices: [
        { variantId, imei: IMEI, condition: "USED", costPrice: 1n },
        { variantId, imei: "490154203237519", condition: "USED", costPrice: 1n },
      ],
    };
    await expect(intakeDevices(db, actor, input, exists)).rejects.toThrow(err("Máy thứ 2: IMEI không hợp lệ"));
    expect(await db.device.count()).toBe(0);
    expect(await db.acquisition.count()).toBe(0);
  });

  it("wholesale needs a source name; laptops can use a serial", async () => {
    const noSource: IntakeInput = { type: "WHOLESALE", devices: [{ variantId, serial: "c02xg1-abjg5h", condition: "USED", costPrice: 1n }] };
    await expect(intakeDevices(db, actor, noSource, exists)).rejects.toThrow(err("Vui lòng nhập tên nguồn hàng"));
    const r = await intakeDevices(db, actor, { ...noSource, sourceName: "Mối buôn A" }, exists);
    expect((await db.device.findUniqueOrThrow({ where: { id: r.deviceIds[0] } })).serial).toBe("C02XG1ABJG5H");
  });

  it("rejects an empty slip and a negative price", async () => {
    await expect(intakeDevices(db, actor, tradeIn({ devices: [] }), exists)).rejects.toThrow(err("Phiếu nhập chưa có máy nào"));
    const neg = tradeIn({ devices: [{ variantId, imei: IMEI, condition: "USED", costPrice: -1n }] });
    await expect(intakeDevices(db, actor, neg, exists)).rejects.toThrow(err("Máy thứ 1: giá nhập không hợp lệ"));
  });
});

describe("buyback of a sold device", () => {
  it("reuses the device record, keeps history, resets inspection fields", async () => {
    const old = await db.device.create({
      data: {
        variantId,
        imei: IMEI,
        condition: "USED",
        grade: "A",
        batteryPct: 90,
        listPrice: 9_000_000n,
        costPrice: 6_000_000n,
        status: "SOLD",
        events: { create: [{ toStatus: "INTAKE" }, { fromStatus: "LISTED", toStatus: "SOLD" }] },
      },
    });
    const r = await intakeDevices(db, actor, tradeIn(), exists);
    expect(r.deviceIds).toEqual([old.id]);
    const d = await db.device.findUniqueOrThrow({ where: { id: old.id }, include: { events: true } });
    expect(d).toMatchObject({ status: "INTAKE", costPrice: 7_000_000n, grade: null, batteryPct: null, listPrice: null, acquisitionId: r.acquisitionId });
    expect(d.events).toHaveLength(3);
  });

  it("warns when the IMEI was taken in twice within 90 days", async () => {
    const now = new Date("2026-11-14T08:00:00Z");
    const d = await db.device.create({ data: { variantId, imei: IMEI, condition: "USED", costPrice: 1n, status: "SOLD" } });
    for (let i = 0; i < 2; i++) {
      const acq = await db.acquisition.create({
        data: { type: "TRADE_IN", totalPrice: 1n, createdById: actor.id, createdAt: new Date(now.getTime() - (10 + i) * 86_400_000) },
      });
      await db.deviceEvent.create({ data: { deviceId: d.id, toStatus: "INTAKE", reason: `acq:${acq.id}` } });
      await db.device.update({ where: { id: d.id }, data: { acquisitionId: acq.id } });
    }
    const check = await checkIdentifier(db, { imei: IMEI }, now);
    expect(check).toEqual({ status: "buyback", deviceId: d.id, recentAcquisitions: 2 });

    const r = await intakeDevices(db, actor, tradeIn(), { ...exists, now });
    expect(r.warnings).toEqual([`IMEI ${IMEI} đã được nhập 2 lần trong 90 ngày, cần xem xét nguồn gốc`]);
  });
});

describe("checkIdentifier", () => {
  it("classifies new / in-stock / blocked", async () => {
    expect(await checkIdentifier(db, { imei: IMEI2 })).toEqual({ status: "new" });
    const d = await db.device.create({ data: { variantId, imei: IMEI2, condition: "USED", costPrice: 1n, status: "INSPECTING" } });
    expect(await checkIdentifier(db, { imei: IMEI2 })).toEqual({ status: "in-stock", deviceId: d.id });
    await db.device.update({ where: { id: d.id }, data: { status: "REJECTED" } });
    expect(await checkIdentifier(db, { imei: IMEI2 })).toEqual({ status: "blocked", deviceId: d.id });
  });
});
