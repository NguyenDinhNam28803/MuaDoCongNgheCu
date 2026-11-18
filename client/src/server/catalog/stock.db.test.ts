import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "../../../test/db";
import { CatalogRuleError } from "./errors";
import { createProduct, getProduct } from "./products";
import { adjustAccessoryStock } from "./stock";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function accessory(stockQty: number) {
  const { productId } = await createProduct(db, {
    name: "Củ sạc 20W",
    brand: "OEM",
    category: "ACCESSORY",
    firstVariant: { isSerialized: false, referencePrice: null, newPrice: 250_000n },
  });
  const id = (await getProduct(db, productId))!.variants[0].id;
  await db.productVariant.update({ where: { id }, data: { stockQty } });
  return id;
}

describe("adjustAccessoryStock", () => {
  it("adds and removes stock down to zero", async () => {
    const id = await accessory(3);
    expect(await adjustAccessoryStock(db, id, 5)).toEqual({ stockQty: 8 });
    expect(await adjustAccessoryStock(db, id, -8)).toEqual({ stockQty: 0 });
  });

  it("refuses to go negative and keeps the stock", async () => {
    const id = await accessory(2);
    await expect(adjustAccessoryStock(db, id, -3)).rejects.toThrow(new CatalogRuleError("Không đủ hàng trong kho"));
    expect((await db.productVariant.findUniqueOrThrow({ where: { id } })).stockQty).toBe(2);
  });

  it("refuses serialized variants", async () => {
    const { productId } = await createProduct(db, {
      name: "iPhone 13",
      brand: "Apple",
      category: "PHONE",
      firstVariant: { storage: "128GB", isSerialized: true, referencePrice: 7_500_000n, newPrice: null },
    });
    const id = (await getProduct(db, productId))!.variants[0].id;
    await expect(adjustAccessoryStock(db, id, 1)).rejects.toThrow(
      new CatalogRuleError("Máy có serial quản lý theo từng máy, không chỉnh số lượng"),
    );
  });

  it("rejects a zero or non-integer delta", async () => {
    const id = await accessory(1);
    await expect(adjustAccessoryStock(db, id, 0)).rejects.toThrow(CatalogRuleError);
    await expect(adjustAccessoryStock(db, id, 1.5)).rejects.toThrow(CatalogRuleError);
  });

  it("two concurrent -1 on stock 1: exactly one wins", async () => {
    const id = await accessory(1);
    const results = await Promise.allSettled([adjustAccessoryStock(db, id, -1), adjustAccessoryStock(db, id, -1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id } })).stockQty).toBe(0);
  });
});
