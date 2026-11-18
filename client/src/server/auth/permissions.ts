import type { Role } from "@/generated/prisma/enums";

export const ALL_PERMISSIONS = [
  "device.intake",
  "device.inspect",
  "order.sell",
  "device.viewCost",
  "device.editPrice",
  "acquisition.viewSeller",
  "report.viewProfit",
  "catalog.manage",
  "user.manage",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

/** Nhân viên: bán và nhập máy; không thấy giá vốn, thông tin người bán, báo cáo lãi. */
const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "device.intake",
  "device.inspect",
  "order.sell",
]);

export class ForbiddenError extends Error {
  constructor(readonly permission: Permission) {
    super("Bạn không có quyền thực hiện thao tác này");
    this.name = "ForbiddenError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return role === "OWNER" || STAFF_PERMISSIONS.has(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}
