// Truy vấn kho cho trang quản trị. Ẩn trường theo quyền NGAY Ở SERVER:
// không có quyền thì không select, DTO không có khóa đó → không thể lọt xuống trình duyệt.
import type { AcquisitionType, Condition, DeviceStatus, Grade } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import type { Db } from "../db";
import { assertCan, can } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { variantLabel } from "../catalog/products";
import { availableForSaleWhere } from "../devices/service";
import { inventoryAgeDays } from "../reports/profit";
import { createViewUrl } from "../storage/s3";

export const INVENTORY_TABS = ["processing", "listed", "reserved", "sold", "rejected"] as const;
export type InventoryTab = (typeof INVENTORY_TABS)[number];

export const PAGE_SIZE = 50;

export type DeviceListItem = {
  id: string;
  imei: string | null;
  serial: string | null;
  productName: string;
  variantLabel: string;
  condition: Condition;
  grade: Grade | null;
  status: DeviceStatus;
  listPrice: bigint | null;
  ageDays: number;
  costPrice?: bigint;
};

export type DeviceEventItem = {
  fromStatus: DeviceStatus | null;
  toStatus: DeviceStatus;
  actorName: string | null;
  reason: string | null;
  createdAt: Date;
};

export type AcquisitionInfo = {
  type: AcquisitionType;
  createdAt: Date;
  sellerName: string | null;
  sellerPhone: string | null;
  sourceName: string | null;
  hasIdDoc: boolean;
  totalPrice: bigint;
};

export type DeviceDetail = DeviceListItem & {
  regionCode: string | null;
  batteryPct: number | null;
  isRefurbished: boolean;
  events: DeviceEventItem[];
  acquisition?: AcquisitionInfo;
};

export function tabWhere(tab: InventoryTab, now: Date): Prisma.DeviceWhereInput {
  switch (tab) {
    case "processing":
      return { status: { in: ["INTAKE", "INSPECTING", "REFURBISHING", "RETURNED"] } };
    case "listed":
      return availableForSaleWhere(now);
    case "reserved":
      return { status: "RESERVED", reservedUntil: { gt: now } };
    case "sold":
      return { status: "SOLD" };
    case "rejected":
      return { status: "REJECTED" };
  }
}

const searchKey = (s: string) => slugify(s).replace(/-/g, "");

async function searchWhere(db: Db, q: string | undefined): Promise<Prisma.DeviceWhereInput> {
  const query = q?.trim();
  if (!query) return {};

  // Tên model: so khớp không dấu trên danh sách biến thể (vài trăm dòng).
  const key = searchKey(query);
  const variants = await db.productVariant.findMany({
    select: { id: true, storage: true, ram: true, color: true, product: { select: { name: true, brand: true } } },
  });
  const ids = variants
    .filter((v) => searchKey(`${v.product.brand} ${v.product.name} ${variantLabel(v)}`).includes(key))
    .map((v) => v.id);
  const or: Prisma.DeviceWhereInput[] = [{ variantId: { in: ids } }];

  // Đuôi IMEI / một phần serial (≥ 4 ký tự, có chữ số).
  const compact = query.replace(/[\s-]/g, "");
  if (/^[A-Za-z0-9]{4,}$/.test(compact) && /\d/.test(compact)) {
    or.push({ imei: { contains: compact } }, { serial: { contains: compact.toUpperCase() } });
  }
  return { OR: or };
}

const baseSelect = {
  id: true,
  imei: true,
  serial: true,
  condition: true,
  grade: true,
  status: true,
  listPrice: true,
  listedAt: true,
  createdAt: true,
  variant: { select: { storage: true, ram: true, color: true, product: { select: { name: true } } } },
} as const;

type BaseRow = Prisma.DeviceGetPayload<{ select: typeof baseSelect }> & { costPrice?: bigint };

function toListItem(row: BaseRow, showCost: boolean, now: Date): DeviceListItem {
  const item: DeviceListItem = {
    id: row.id,
    imei: row.imei,
    serial: row.serial,
    productName: row.variant.product.name,
    variantLabel: variantLabel(row.variant),
    condition: row.condition,
    grade: row.grade,
    status: row.status,
    listPrice: row.listPrice,
    ageDays: inventoryAgeDays(row.listedAt ?? row.createdAt, now),
  };
  if (showCost && row.costPrice !== undefined) item.costPrice = row.costPrice;
  return item;
}

export async function listDevices(
  db: Db,
  viewer: SessionUser,
  filter: { tab: InventoryTab; q?: string; page?: number },
  now: Date = new Date(),
): Promise<{ items: DeviceListItem[]; total: number }> {
  const showCost = can(viewer.role, "device.viewCost");
  const where: Prisma.DeviceWhereInput = { AND: [tabWhere(filter.tab, now), await searchWhere(db, filter.q)] };
  const page = Math.max(1, Math.floor(filter.page ?? 1));

  const [rows, total] = await Promise.all([
    db.device.findMany({
      where,
      select: { ...baseSelect, ...(showCost && { costPrice: true }) },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.device.count({ where }),
  ]);
  return { items: rows.map((r) => toListItem(r as BaseRow, showCost, now)), total };
}

export async function countDevicesByTab(db: Db, now: Date = new Date()): Promise<Record<InventoryTab, number>> {
  const counts = await Promise.all(INVENTORY_TABS.map((tab) => db.device.count({ where: tabWhere(tab, now) })));
  return Object.fromEntries(INVENTORY_TABS.map((tab, i) => [tab, counts[i]])) as Record<InventoryTab, number>;
}

export async function getDeviceDetail(
  db: Db,
  viewer: SessionUser,
  deviceId: string,
  now: Date = new Date(),
): Promise<DeviceDetail | null> {
  const showCost = can(viewer.role, "device.viewCost");
  const showSeller = can(viewer.role, "acquisition.viewSeller");

  const row = await db.device.findUnique({
    where: { id: deviceId },
    select: {
      ...baseSelect,
      ...(showCost && { costPrice: true }),
      regionCode: true,
      batteryPct: true,
      isRefurbished: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: { fromStatus: true, toStatus: true, reason: true, createdAt: true, actor: { select: { name: true } } },
      },
      ...(showSeller && {
        acquisition: {
          select: {
            type: true,
            createdAt: true,
            sellerName: true,
            sellerPhone: true,
            sourceName: true,
            sellerIdDocKey: true,
            totalPrice: true,
          },
        },
      }),
    },
  });
  if (!row) return null;

  const detail: DeviceDetail = {
    ...toListItem(row as unknown as BaseRow, showCost, now),
    regionCode: row.regionCode,
    batteryPct: row.batteryPct,
    isRefurbished: row.isRefurbished,
    events: row.events.map((e) => ({
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorName: e.actor?.name ?? null,
      reason: e.reason,
      createdAt: e.createdAt,
    })),
  };

  const acq = (row as { acquisition?: { sellerIdDocKey: string | null } & Omit<AcquisitionInfo, "hasIdDoc"> | null })
    .acquisition;
  if (showSeller && acq) {
    detail.acquisition = {
      type: acq.type,
      createdAt: acq.createdAt,
      sellerName: acq.sellerName,
      sellerPhone: acq.sellerPhone,
      sourceName: acq.sourceName,
      hasIdDoc: !!acq.sellerIdDocKey,
      totalPrice: acq.totalPrice,
    };
  }
  return detail;
}

export async function getIdDocViewUrl(db: Db, viewer: SessionUser, deviceId: string): Promise<string | null> {
  assertCan(viewer.role, "acquisition.viewSeller");
  const row = await db.device.findUnique({
    where: { id: deviceId },
    select: { acquisition: { select: { sellerIdDocKey: true } } },
  });
  const key = row?.acquisition?.sellerIdDocKey;
  return key ? createViewUrl("id-doc", key) : null;
}
