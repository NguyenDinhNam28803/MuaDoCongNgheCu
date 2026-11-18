import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "../../../test/db";
import { DEFAULT_SHOP_INFO, ShopSettingError, getShopInfo, saveShopInfo } from "./settings";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("shop info", () => {
  it("falls back to defaults", async () => {
    expect(await getShopInfo(db)).toEqual(DEFAULT_SHOP_INFO);
  });

  it("merges saved values over defaults and normalizes phones", async () => {
    await saveShopInfo(db, { name: "Táo Xanh Store", phone: "+84 912 345 678", zalo: "0912 345 678" });
    const info = await getShopInfo(db);
    expect(info).toMatchObject({ name: "Táo Xanh Store", phone: "0912345678", zalo: "0912345678" });
    expect(info.warrantyUsedDays).toBe(DEFAULT_SHOP_INFO.warrantyUsedDays);
  });

  it("validates input", async () => {
    await expect(saveShopInfo(db, { name: " " })).rejects.toThrow(new ShopSettingError("Vui lòng nhập tên cửa hàng"));
    await expect(saveShopInfo(db, { phone: "123" })).rejects.toThrow(new ShopSettingError("Số điện thoại không hợp lệ"));
    await expect(saveShopInfo(db, { warrantyUsedDays: -1 })).rejects.toThrow(new ShopSettingError("Số ngày bảo hành không hợp lệ"));
  });

  it("ignores corrupted stored values", async () => {
    await db.shopSetting.create({ data: { key: "shop.info", value: { name: 123, phone: "0912345678" } } });
    const info = await getShopInfo(db);
    expect(info.name).toBe(DEFAULT_SHOP_INFO.name);
    expect(info.phone).toBe("0912345678");
  });
});
