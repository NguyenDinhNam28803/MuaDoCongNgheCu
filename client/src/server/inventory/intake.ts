// Nhập máy: một phiếu (Acquisition) + các máy (Device ở INTAKE) + DeviceEvent, trong một giao dịch.
// Quy tắc cứng hóa từ báo cáo: định danh người bán + cam kết nguồn gốc + đồng ý lưu dữ liệu khi thu từ khách lẻ;
// IMEI duy nhất + lịch sử; máy từng bị loại không nhận lại; máy đã bán quay lại dùng lại bản ghi cũ.
import type { AcquisitionType, Condition } from "@/generated/prisma/enums";
import { normalizeImei, normalizeSerial } from "@/lib/device-id";
import type { Db } from "../db";
import { normalizePhone } from "../auth/phone";
import type { SessionUser } from "../auth/session";
import { transitionInTx } from "../devices/service";
import { isKeyOfKind, type PhotoKind } from "../storage/keys";
import { objectExists as s3ObjectExists } from "../storage/s3";
import { IntakeRuleError } from "./errors";

export const IMEI_RECENT_WINDOW_DAYS = 90;
export const IMEI_RECENT_WARN_COUNT = 2;

export type IdentifierCheck =
  | { status: "new" }
  | { status: "buyback"; deviceId: string; recentAcquisitions: number }
  | { status: "in-stock"; deviceId: string }
  | { status: "blocked"; deviceId: string };

/** Máy với IMEI/serial này đã có trong hệ thống chưa, và có được nhập không. */
export async function checkIdentifier(
  db: Db,
  id: { imei?: string; serial?: string },
  now: Date = new Date(),
): Promise<IdentifierCheck> {
  const where = id.imei ? { imei: id.imei } : id.serial ? { serial: id.serial } : null;
  if (!where) return { status: "new" };
  const device = await db.device.findUnique({ where, select: { id: true, status: true } });
  if (!device) return { status: "new" };
  if (device.status === "REJECTED") return { status: "blocked", deviceId: device.id };
  if (device.status !== "SOLD") return { status: "in-stock", deviceId: device.id };

  const since = new Date(now.getTime() - IMEI_RECENT_WINDOW_DAYS * 86_400_000);
  const recentAcquisitions = await db.deviceEvent.count({
    where: { deviceId: device.id, toStatus: "INTAKE", createdAt: { gte: since } },
  });
  return { status: "buyback", deviceId: device.id, recentAcquisitions };
}

export type IntakeDeviceInput = {
  variantId: string;
  imei?: string;
  serial?: string;
  condition: Condition;
  costPrice: bigint;
  regionCode?: string;
};

export type IntakeInput = {
  type: AcquisitionType;
  seller?: { name: string; phone: string; idDocKey: string; originPledged: boolean; consent: boolean };
  sourceName?: string;
  note?: string;
  devices: IntakeDeviceInput[];
};

export type IntakeDeps = {
  objectExists?: (kind: PhotoKind, key: string) => Promise<boolean>;
  now?: Date;
};

type CheckedDevice = Omit<IntakeDeviceInput, "imei" | "serial"> & { imei: string | null; serial: string | null };

function validate(input: IntakeInput) {
  if (input.devices.length === 0) throw new IntakeRuleError("Phiếu nhập chưa có máy nào");

  let seller: (NonNullable<IntakeInput["seller"]> & { phone: string }) | null = null;
  if (input.type === "TRADE_IN") {
    const s = input.seller;
    if (!s) throw new IntakeRuleError("Thu từ khách lẻ cần thông tin người bán");
    if (!s.name.trim()) throw new IntakeRuleError("Vui lòng nhập tên người bán");
    const phone = normalizePhone(s.phone);
    if (!phone) throw new IntakeRuleError("Số điện thoại người bán không hợp lệ");
    if (!s.idDocKey) throw new IntakeRuleError("Vui lòng chụp ảnh giấy tờ người bán");
    if (!isKeyOfKind(s.idDocKey, "id-doc")) throw new IntakeRuleError("Ảnh giấy tờ không hợp lệ");
    if (!s.originPledged) throw new IntakeRuleError("Người bán phải cam kết nguồn gốc máy");
    if (!s.consent) throw new IntakeRuleError("Người bán phải đồng ý cho lưu thông tin");
    seller = { ...s, name: s.name.trim(), phone };
  } else if (!input.sourceName?.trim()) {
    throw new IntakeRuleError("Vui lòng nhập tên nguồn hàng");
  }

  const seen = new Set<string>();
  const devices: CheckedDevice[] = input.devices.map((d, i) => {
    const label = `Máy thứ ${i + 1}`;
    if (d.costPrice < 0n) throw new IntakeRuleError(`${label}: giá nhập không hợp lệ`);
    if (input.type === "NEW_STOCK" && d.condition !== "NEW") {
      throw new IntakeRuleError("Hàng nhập từ nhà phân phối phải là máy mới");
    }
    const imei = d.imei?.trim() ? normalizeImei(d.imei) : null;
    if (d.imei?.trim() && !imei) throw new IntakeRuleError(`${label}: IMEI không hợp lệ`);
    const serial = d.serial?.trim() ? normalizeSerial(d.serial) : null;
    if (d.serial?.trim() && !serial) throw new IntakeRuleError(`${label}: serial không hợp lệ`);
    if (!imei && !serial) throw new IntakeRuleError(`${label}: cần IMEI hoặc serial`);

    for (const key of [imei && `i:${imei}`, serial && `s:${serial}`]) {
      if (!key) continue;
      if (seen.has(key)) throw new IntakeRuleError("IMEI bị lặp trong phiếu");
      seen.add(key);
    }
    return { ...d, imei, serial };
  });

  return { seller, devices };
}

export async function intakeDevices(
  db: Db,
  actor: SessionUser,
  input: IntakeInput,
  deps: IntakeDeps = {},
): Promise<{ acquisitionId: string; deviceIds: string[]; warnings: string[] }> {
  const now = deps.now ?? new Date();
  const exists = deps.objectExists ?? s3ObjectExists;
  const { seller, devices } = validate(input);

  // Model phải là máy có serial, đang hiển thị.
  const variantIds = [...new Set(devices.map((d) => d.variantId))];
  const okVariants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isSerialized: true, archived: false, product: { archived: false } },
    select: { id: true },
  });
  const okSet = new Set(okVariants.map((v) => v.id));

  const warnings: string[] = [];
  const plans: Array<{ device: CheckedDevice; check: IdentifierCheck }> = [];
  for (const [i, device] of devices.entries()) {
    const label = `Máy thứ ${i + 1}`;
    if (!okSet.has(device.variantId)) throw new IntakeRuleError(`${label}: model không hợp lệ`);
    const check = await checkIdentifier(db, device.imei ? { imei: device.imei } : { serial: device.serial! }, now);
    if (check.status === "in-stock") throw new IntakeRuleError(`${label}: IMEI đang có trong kho`);
    if (check.status === "blocked") {
      throw new IntakeRuleError(`${label}: máy này từng bị loại (khóa tài khoản/không đạt), không nhận`);
    }
    if (check.status === "buyback" && check.recentAcquisitions >= IMEI_RECENT_WARN_COUNT) {
      warnings.push(
        `IMEI ${device.imei ?? device.serial} đã được nhập ${check.recentAcquisitions} lần trong ${IMEI_RECENT_WINDOW_DAYS} ngày, cần xem xét nguồn gốc`,
      );
    }
    plans.push({ device, check });
  }

  if (seller && !(await exists("id-doc", seller.idDocKey))) {
    throw new IntakeRuleError("Ảnh giấy tờ chưa tải lên xong, vui lòng chụp lại");
  }

  const totalPrice = devices.reduce((sum, d) => sum + d.costPrice, 0n);

  return db.$transaction(async (tx) => {
    const acquisition = await tx.acquisition.create({
      data: {
        type: input.type,
        sellerName: seller?.name ?? null,
        sellerPhone: seller?.phone ?? null,
        sellerIdDocKey: seller?.idDocKey ?? null,
        originPledged: seller?.originPledged ?? false,
        sellerConsent: seller?.consent ?? false,
        sourceName: input.sourceName?.trim() || null,
        note: input.note?.trim() || null,
        totalPrice,
        createdById: actor.id,
      },
      select: { id: true },
    });

    const deviceIds: string[] = [];
    for (const { device, check } of plans) {
      const fields = {
        costPrice: device.costPrice,
        condition: device.condition,
        regionCode: device.regionCode?.trim() || null,
        acquisitionId: acquisition.id,
      };
      if (check.status === "buyback") {
        await transitionInTx(tx, {
          deviceId: check.deviceId,
          from: "SOLD",
          to: "INTAKE",
          actorId: actor.id,
          reason: "Mua lại máy đã bán",
          data: { ...fields, grade: null, batteryPct: null, listPrice: null, isRefurbished: false, listedAt: null, soldAt: null },
        });
        deviceIds.push(check.deviceId);
      } else {
        const created = await tx.device.create({
          data: {
            ...fields,
            variantId: device.variantId,
            imei: device.imei,
            serial: device.serial,
            status: "INTAKE",
            events: { create: { toStatus: "INTAKE", actorId: actor.id, reason: "Nhập máy" } },
          },
          select: { id: true },
        });
        deviceIds.push(created.id);
      }
    }
    return { acquisitionId: acquisition.id, deviceIds, warnings };
  });
}
