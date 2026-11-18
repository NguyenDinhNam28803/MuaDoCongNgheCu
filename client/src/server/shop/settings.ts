// Thông tin cửa hàng hiển thị trên website (ShopSetting key "shop.info"), gộp với mặc định.
import { z } from "zod";
import type { Db } from "../db";
import { normalizePhone } from "../auth/phone";

export type ShopInfo = {
  name: string;
  phone: string;
  zalo: string;
  address: string;
  hours: string;
  warrantyUsedDays: number;
  warrantyText: string;
  returnText: string;
};

export const DEFAULT_SHOP_INFO: ShopInfo = {
  name: "TECNOVA",
  phone: "0900000000",
  zalo: "0900000000",
  address: "Cập nhật địa chỉ trong Quản trị → Cài đặt",
  hours: "8:00 – 21:00 hằng ngày",
  warrantyUsedDays: 30,
  warrantyText:
    "Máy đã qua sử dụng bảo hành 30 ngày lỗi phần cứng do nhà sản xuất. Máy mới bảo hành theo chính sách hãng.",
  returnText:
    "Đổi máy hoặc hoàn tiền trong 7 ngày nếu máy không đúng như mô tả trong báo cáo kiểm định. Mang theo phiếu bảo hành khi đổi trả.",
};

const KEY = "shop.info";

export class ShopSettingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopSettingError";
  }
}

const storedSchema = z
  .object({
    name: z.string(),
    phone: z.string(),
    zalo: z.string(),
    address: z.string(),
    hours: z.string(),
    warrantyUsedDays: z.number().int().nonnegative(),
    warrantyText: z.string(),
    returnText: z.string(),
  })
  .partial();

export async function getShopInfo(db: Db): Promise<ShopInfo> {
  const row = await db.shopSetting.findUnique({ where: { key: KEY } });
  if (!row || typeof row.value !== "object" || row.value === null) return DEFAULT_SHOP_INFO;
  // Bỏ qua từng trường hỏng thay vì làm hỏng cả trang.
  const merged: ShopInfo = { ...DEFAULT_SHOP_INFO };
  for (const [k, v] of Object.entries(row.value as Record<string, unknown>)) {
    const field = storedSchema.shape[k as keyof ShopInfo];
    if (field && field.safeParse(v).success) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

export async function saveShopInfo(db: Db, patch: Partial<ShopInfo>): Promise<ShopInfo> {
  const current = await getShopInfo(db);
  const next: ShopInfo = { ...current };

  for (const [k, raw] of Object.entries(patch) as [keyof ShopInfo, unknown][]) {
    if (raw === undefined) continue;
    if (k === "warrantyUsedDays") {
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 3650) {
        throw new ShopSettingError("Số ngày bảo hành không hợp lệ");
      }
      next.warrantyUsedDays = raw;
      continue;
    }
    const value = String(raw).trim();
    if (k === "phone" || k === "zalo") {
      const phone = normalizePhone(value);
      if (!phone) throw new ShopSettingError("Số điện thoại không hợp lệ");
      next[k] = phone;
    } else {
      if (k === "name" && !value) throw new ShopSettingError("Vui lòng nhập tên cửa hàng");
      next[k] = value;
    }
  }

  await db.shopSetting.upsert({ where: { key: KEY }, update: { value: next }, create: { key: KEY, value: next } });
  return next;
}
