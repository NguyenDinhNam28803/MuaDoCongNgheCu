import type { AcquisitionType, Condition, DeviceStatus } from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  INTAKE: "Tiếp nhận",
  INSPECTING: "Kiểm định",
  REFURBISHING: "Tân trang",
  LISTED: "Đang bán",
  RESERVED: "Đang giữ",
  SOLD: "Đã bán",
  RETURNED: "Trả về",
  REJECTED: "Loại bỏ",
};

export const CONDITION_LABEL: Record<Condition, string> = { NEW: "Mới", USED: "Đã dùng" };

export const ACQUISITION_LABEL: Record<AcquisitionType, string> = {
  TRADE_IN: "Thu từ khách",
  WHOLESALE: "Nhập buôn",
  NEW_STOCK: "Nhập máy mới (NPP)",
};

/** "…7518" — 4 ký tự cuối IMEI/serial để nhận diện nhanh. */
export function shortId(imei: string | null, serial: string | null): string {
  const id = imei ?? serial;
  return id ? `…${id.slice(-4)}` : "—";
}
