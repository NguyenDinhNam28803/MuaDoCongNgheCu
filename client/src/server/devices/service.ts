// Module lõi "Thiết bị + kho": Đơn hàng, Thu cũ, Bảo hành đổi trạng thái máy QUA ĐÂY,
// không ghi thẳng vào bảng Device.
import type { DeviceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "../db";
import { DeviceConflictError } from "./errors";
import { assertInspectionGate, assertTransition, requiresInspectionGate } from "./state-machine";

/**
 * Điều kiện "máy còn bán được": LISTED, hoặc RESERVED đã quá hạn giữ
 * (hết hạn giữ xử lý "lười" ngay khi truy vấn; cron chỉ dọn dẹp).
 */
export function availableForSaleWhere(now: Date): Prisma.DeviceWhereInput {
  return {
    OR: [{ status: "LISTED" }, { status: "RESERVED", reservedUntil: { lt: now } }],
  };
}

function statusWhere(from: DeviceStatus, now: Date): Prisma.DeviceWhereInput {
  return from === "LISTED" ? availableForSaleWhere(now) : { status: from };
}

export interface TransitionInput {
  deviceId: string;
  from: DeviceStatus;
  to: DeviceStatus;
  /** Truyền version đã đọc để phát hiện thay đổi đồng thời (khóa lạc quan). */
  expectedVersion?: number;
  actorId?: string | null;
  reason?: string;
  now?: Date;
}

export type Tx = Prisma.TransactionClient;

/**
 * Chuyển trạng thái + ghi DeviceEvent bên trong một giao dịch có sẵn (vd. phiếu nhập máy).
 * `data` được gộp vào cùng câu cập nhật có điều kiện (đổi giá vốn, phiếu nhập… cùng lúc).
 */
export async function transitionInTx(
  tx: Tx,
  input: TransitionInput & { data?: Prisma.DeviceUpdateManyMutationInput },
): Promise<void> {
  const { deviceId, from, to, expectedVersion, actorId = null, reason } = input;
  const now = input.now ?? new Date();
  assertTransition(from, to);

  if (requiresInspectionGate(from, to)) {
    const latest = await tx.inspectionReport.findFirst({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      select: { passed: true, accountLocked: true, dataWiped: true },
    });
    assertInspectionGate(latest);
  }

  const data: Prisma.DeviceUpdateManyMutationInput = {
    ...input.data,
    status: to,
    version: { increment: 1 },
    reservedUntil: null,
  };
  if (to === "LISTED") data.listedAt = now;
  if (to === "SOLD") data.soldAt = now;

  const { count } = await tx.device.updateMany({
    where: {
      id: deviceId,
      ...statusWhere(from, now),
      ...(expectedVersion !== undefined && { version: expectedVersion }),
    },
    data,
  });
  if (count === 0) throw new DeviceConflictError(deviceId);

  await tx.deviceEvent.create({
    data: { deviceId, fromStatus: from, toStatus: to, actorId, reason },
  });
}

/** Chuyển trạng thái + ghi DeviceEvent trong cùng một giao dịch. */
export async function transition(db: Db, input: TransitionInput): Promise<void> {
  await db.$transaction((tx) => transitionInTx(tx, input));
}

export interface ReserveInput {
  deviceId: string;
  holdMinutes: number;
  actorId?: string | null;
  reason?: string;
  now?: Date;
}

/**
 * Giữ máy cho khách đặt online. Compare-and-set ở tầng DB:
 * chỉ một trong các yêu cầu đồng thời thành công; số dòng cập nhật = 0 → DeviceConflictError.
 */
export async function reserveDevice(db: Db, input: ReserveInput): Promise<{ reservedUntil: Date }> {
  const now = input.now ?? new Date();
  const reservedUntil = new Date(now.getTime() + input.holdMinutes * 60_000);

  await db.$transaction(async (tx) => {
    const { count } = await tx.device.updateMany({
      where: { id: input.deviceId, ...availableForSaleWhere(now) },
      data: { status: "RESERVED", reservedUntil, version: { increment: 1 } },
    });
    if (count === 0) throw new DeviceConflictError(input.deviceId);

    await tx.deviceEvent.create({
      data: {
        deviceId: input.deviceId,
        fromStatus: "LISTED",
        toStatus: "RESERVED",
        actorId: input.actorId ?? null,
        reason: input.reason ?? `Giữ máy đến ${reservedUntil.toISOString()}`,
      },
    });
  });

  return { reservedUntil };
}

/** Cron dọn dẹp: đưa máy giữ quá hạn về LISTED. Trả về số máy đã dọn. */
export async function releaseExpiredReservations(db: Db, now = new Date()): Promise<number> {
  const expired = await db.device.findMany({
    where: { status: "RESERVED", reservedUntil: { lt: now } },
    select: { id: true },
  });

  let released = 0;
  for (const { id } of expired) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.device.updateMany({
        where: { id, status: "RESERVED", reservedUntil: { lt: now } },
        data: { status: "LISTED", reservedUntil: null, version: { increment: 1 } },
      });
      if (count === 0) return; // đã được bán / gia hạn trong lúc dọn
      await tx.deviceEvent.create({
        data: { deviceId: id, fromStatus: "RESERVED", toStatus: "LISTED", reason: "Hết hạn giữ máy" },
      });
      released++;
    });
  }
  return released;
}
