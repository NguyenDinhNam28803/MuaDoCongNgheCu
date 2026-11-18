import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string; permission?: Permission };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/kho", label: "Kho" },
  { href: "/admin/nhap-may", label: "Nhập máy", permission: "device.intake" },
  { href: "/admin/ban-hang", label: "Bán hàng", permission: "order.sell" },
  { href: "/admin/don-hang", label: "Đơn hàng", permission: "order.sell" },
  { href: "/admin/bao-cao", label: "Báo cáo", permission: "report.viewProfit" },
  { href: "/admin/catalog", label: "Catalog", permission: "catalog.manage" },
  { href: "/admin/nhan-vien", label: "Nhân viên", permission: "user.manage" },
  { href: "/admin/cai-dat", label: "Cài đặt", permission: "user.manage" },
];

export function navItemsFor(role: Role): NavItem[] {
  return ADMIN_NAV.filter((item) => !item.permission || can(role, item.permission));
}
