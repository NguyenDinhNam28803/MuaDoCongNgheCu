// Hàm thuần: không phụ thuộc Next.js hay Prisma runtime.
import type { DeviceStatus } from "@/generated/prisma/enums";
import { InspectionGateError, InvalidTransitionError } from "./errors";

/**
 * Bảng chuyển trạng thái hợp lệ — định nghĩa ở MỘT chỗ duy nhất.
 * Theo sơ đồ vòng đời trong báo cáo, thêm LISTED → SOLD cho "bán nhanh tại quầy"
 * và SOLD → INTAKE khi shop mua lại máy từng bán (giữ nguyên lịch sử máy).
 */
export const DEVICE_TRANSITIONS: Readonly<Record<DeviceStatus, readonly DeviceStatus[]>> = {
  INTAKE: ["INSPECTING"],
  INSPECTING: ["LISTED", "REFURBISHING", "REJECTED"],
  REFURBISHING: ["LISTED"],
  LISTED: ["RESERVED", "SOLD"],
  RESERVED: ["LISTED", "SOLD"],
  SOLD: ["RETURNED", "INTAKE"],
  RETURNED: ["INSPECTING"], // kiểm định lại là cổng duy nhất để lên kệ
  REJECTED: [], // máy khóa tài khoản / không đạt: không bao giờ vào kho bán
};

export function canTransition(from: DeviceStatus, to: DeviceStatus): boolean {
  return DEVICE_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DeviceStatus, to: DeviceStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Chuyển nào phải qua cổng kiểm định (báo cáo kiểm định gần nhất phải đạt). */
export function requiresInspectionGate(from: DeviceStatus, to: DeviceStatus): boolean {
  return (
    (from === "INSPECTING" && (to === "LISTED" || to === "REFURBISHING")) ||
    (from === "REFURBISHING" && to === "LISTED")
  );
}

export interface InspectionGateInput {
  passed: boolean;
  accountLocked: boolean;
  dataWiped: boolean;
}

/** Quy tắc cứng hóa: chặn máy khóa iCloud/Google/MDM và máy chưa xóa dữ liệu. */
export function assertInspectionGate(report: InspectionGateInput | null | undefined): void {
  if (!report) throw new InspectionGateError("Chưa có báo cáo kiểm định");
  if (report.accountLocked) throw new InspectionGateError("Máy còn khóa tài khoản (iCloud/Google/MDM)");
  if (!report.dataWiped) throw new InspectionGateError("Chưa xóa dữ liệu máy");
  if (!report.passed) throw new InspectionGateError("Báo cáo kiểm định không đạt");
}
