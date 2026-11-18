// Kiểm định = cổng duy nhất để lên kệ. Báo cáo bất biến: kiểm lại / tân trang xong → tạo bản mới.
import type { DeviceStatus, Grade } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { formatVnd } from "@/lib/money";
import type { Db } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { transition, transitionInTx } from "../devices/service";
import { isKeyOfKind, type PhotoKind } from "../storage/keys";
import { objectExists as s3ObjectExists } from "../storage/s3";
import { InspectionRuleError } from "./errors";
import { TEMPLATE_VERSION, checklistFor, type ChecklistResult } from "./templates";

export type InspectionDecision = "LIST" | "REFURBISH" | "REJECT";

export type InspectionInput = {
  checklist: ChecklistResult[];
  batteryPct: number | null;
  grade: Grade | null;
  replacedParts: string[];
  regionCode: string | null;
  photoKeys: string[];
  accountLocked: boolean;
  dataWiped: boolean;
  isRefurbished: boolean;
  notes: string | null;
  decision: InspectionDecision;
  listPrice: bigint | null;
};

export type InspectionDeps = {
  objectExists?: (kind: PhotoKind, key: string) => Promise<boolean>;
  now?: Date;
};

const RESULTS = new Set(["ok", "issue", "na"]);
const fail = (m: string): never => {
  throw new InspectionRuleError(m);
};

function checkBattery(pct: number | null | undefined) {
  if (pct !== null && pct !== undefined && (!Number.isInteger(pct) || pct < 0 || pct > 100)) fail("% pin không hợp lệ");
}

async function loadDevice(db: Db, deviceId: string) {
  const device = await db.device.findUnique({
    where: { id: deviceId },
    select: { id: true, status: true, condition: true, variant: { select: { product: { select: { category: true } } } } },
  });
  if (!device) fail("Không tìm thấy máy");
  return device!;
}

async function assertPhotosUploaded(keys: string[], exists: NonNullable<InspectionDeps["objectExists"]>) {
  const results = await Promise.all([...new Set(keys)].map((k) => exists("device", k)));
  if (results.some((ok) => !ok)) fail("Có ảnh chưa tải lên xong, vui lòng chụp lại");
}

/** INTAKE / RETURNED → INSPECTING. */
export async function startInspection(db: Db, actor: SessionUser, deviceId: string): Promise<void> {
  assertCan(actor.role, "device.inspect");
  const device = await loadDevice(db, deviceId);
  if (device.status !== "INTAKE" && device.status !== "RETURNED") fail("Máy không ở trạng thái chờ kiểm định");
  await transition(db, { deviceId, from: device.status, to: "INSPECTING", actorId: actor.id, reason: "Bắt đầu kiểm định" });
}

function normalizeChecklist(category: Parameters<typeof checklistFor>[0], items: ChecklistResult[]): ChecklistResult[] {
  const template = checklistFor(category);
  const byKey = new Map(items.map((i) => [i.key, i]));
  if (items.length !== template.length || byKey.size !== template.length) fail("Checklist chưa đủ");
  return template.map((t) => {
    const r = byKey.get(t.key);
    if (!r || !RESULTS.has(r.result)) fail("Checklist chưa đủ");
    const note = r!.note?.trim();
    return { key: t.key, label: t.label, result: r!.result, ...(note && { note }) };
  });
}

export async function submitInspection(
  db: Db,
  actor: SessionUser,
  deviceId: string,
  input: InspectionInput,
  deps: InspectionDeps = {},
): Promise<{ reportId: string; status: DeviceStatus }> {
  assertCan(actor.role, "device.inspect");
  const device = await loadDevice(db, deviceId);
  const isUsed = device.condition === "USED";
  const notes = input.notes?.trim() || null;
  const photoKeys = input.photoKeys;

  // ── Kiểm tra thuần ──
  if (input.decision === "REJECT") {
    if (!notes) fail("Ghi lý do loại bỏ");
  } else {
    if (input.accountLocked) fail("Máy còn khóa tài khoản: chỉ có thể loại bỏ");
    if (!input.dataWiped) fail("Phải xóa dữ liệu máy trước khi lên kệ");
    const [min, max] = isUsed ? [4, 6] : [1, 6];
    if (photoKeys.length < min || photoKeys.length > max) {
      fail(isUsed ? "Máy đã qua sử dụng cần 4–6 ảnh" : "Máy mới cần 1–6 ảnh");
    }
    if (isUsed && !input.grade) fail("Chọn hạng máy");
    if (input.decision === "LIST" && (!input.listPrice || input.listPrice <= 0n)) fail("Nhập giá bán");
  }
  if (photoKeys.some((k) => !isKeyOfKind(k, "device"))) fail("Ảnh không hợp lệ");
  checkBattery(input.batteryPct);
  const checklist = normalizeChecklist(device.variant.product.category, input.checklist);

  await assertPhotosUploaded(photoKeys, deps.objectExists ?? s3ObjectExists);

  const to: DeviceStatus =
    input.decision === "LIST" ? "LISTED" : input.decision === "REFURBISH" ? "REFURBISHING" : "REJECTED";
  const grade = isUsed ? input.grade : null;

  return db.$transaction(async (tx) => {
    const report = await tx.inspectionReport.create({
      data: {
        deviceId,
        inspectorId: actor.id,
        templateVersion: TEMPLATE_VERSION,
        checklist: checklist as unknown as Prisma.InputJsonValue,
        batteryPct: input.batteryPct,
        grade,
        replacedParts: input.replacedParts.map((p) => p.trim()).filter(Boolean),
        photoKeys,
        accountLocked: input.accountLocked,
        dataWiped: input.dataWiped,
        passed: input.decision !== "REJECT",
        notes,
      },
      select: { id: true },
    });

    const data: Prisma.DeviceUpdateManyMutationInput =
      input.decision === "REJECT"
        ? {}
        : {
            grade,
            batteryPct: input.batteryPct,
            regionCode: input.regionCode?.trim() || null,
            isRefurbished: input.isRefurbished,
            ...(input.decision === "LIST" && { listPrice: input.listPrice }),
          };

    await transitionInTx(tx, {
      deviceId,
      from: "INSPECTING",
      to,
      actorId: actor.id,
      reason: input.decision === "REJECT" ? `Loại bỏ: ${notes}` : "Kiểm định xong",
      data,
      now: deps.now,
    });
    return { reportId: report.id, status: to };
  });
}

/** Tân trang xong: ghi chi phí, tạo bản báo cáo mới phản ánh linh kiện đã thay, lên kệ. */
export async function finishRefurbish(
  db: Db,
  actor: SessionUser,
  deviceId: string,
  input: { cost: bigint; note: string | null; listPrice: bigint; batteryPct?: number | null; replacedParts?: string[] },
): Promise<void> {
  assertCan(actor.role, "device.inspect");
  if (input.listPrice <= 0n) fail("Nhập giá bán");
  if (input.cost < 0n) fail("Chi phí không hợp lệ");
  checkBattery(input.batteryPct);

  await db.$transaction(async (tx) => {
    const latest = await tx.inspectionReport.findFirst({ where: { deviceId }, orderBy: { createdAt: "desc" } });
    if (!latest) fail("Máy chưa có báo cáo kiểm định");
    const note = input.note?.trim() || null;
    const batteryPct = input.batteryPct ?? latest!.batteryPct;
    const replacedParts = [...new Set([...latest!.replacedParts, ...(input.replacedParts ?? [])])];

    await tx.inspectionReport.create({
      data: {
        deviceId,
        inspectorId: actor.id,
        templateVersion: latest!.templateVersion,
        checklist: latest!.checklist as Prisma.InputJsonValue,
        batteryPct,
        grade: latest!.grade,
        replacedParts,
        photoKeys: latest!.photoKeys,
        accountLocked: latest!.accountLocked,
        dataWiped: latest!.dataWiped,
        passed: true,
        notes: note ? `Sau tân trang: ${note}` : "Sau tân trang",
      },
    });
    if (input.cost > 0n) {
      await tx.deviceCost.create({ data: { deviceId, type: "REFURBISH", amount: input.cost, note } });
    }
    await transitionInTx(tx, {
      deviceId,
      from: "REFURBISHING",
      to: "LISTED",
      actorId: actor.id,
      reason: "Tân trang xong",
      data: { isRefurbished: true, listPrice: input.listPrice, batteryPct },
    });
  });
}

/** Đổi giá máy đang bán — chỉ Chủ cửa hàng. */
export async function updateListPrice(db: Db, actor: SessionUser, deviceId: string, price: bigint): Promise<void> {
  assertCan(actor.role, "device.editPrice");
  if (price <= 0n) fail("Giá bán không hợp lệ");
  const device = await db.device.findUnique({ where: { id: deviceId }, select: { status: true, listPrice: true } });
  if (!device || (device.status !== "LISTED" && device.status !== "RESERVED")) fail("Chỉ đổi giá máy đang bán");

  await db.$transaction(async (tx) => {
    const { count } = await tx.device.updateMany({
      where: { id: deviceId, status: device!.status },
      data: { listPrice: price, version: { increment: 1 } },
    });
    if (count === 0) fail("Máy vừa thay đổi, vui lòng tải lại");
    await tx.deviceEvent.create({
      data: {
        deviceId,
        fromStatus: device!.status,
        toStatus: device!.status,
        actorId: actor.id,
        reason: `Đổi giá: ${formatVnd(device!.listPrice)} → ${formatVnd(price)}`,
      },
    });
  });
}

export type PublicReport = {
  id: string;
  createdAt: Date;
  templateVersion: number;
  checklist: ChecklistResult[];
  batteryPct: number | null;
  grade: Grade | null;
  replacedParts: string[];
  photoKeys: string[];
  notes: string | null;
};

/** Báo cáo mới nhất (không kèm người kiểm định / cờ nội bộ). */
export async function getLatestReport(db: Db, deviceId: string): Promise<PublicReport | null> {
  const r = await db.inspectionReport.findFirst({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      templateVersion: true,
      checklist: true,
      batteryPct: true,
      grade: true,
      replacedParts: true,
      photoKeys: true,
      notes: true,
    },
  });
  return r ? { ...r, checklist: r.checklist as unknown as ChecklistResult[] } : null;
}
