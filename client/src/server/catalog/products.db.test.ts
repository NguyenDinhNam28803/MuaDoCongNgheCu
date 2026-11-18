import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "../../../test/db";
import { CatalogRuleError } from "./errors";
import {
  addVariant,
  createProduct,
  deleteVariant,
  getProduct,
  listProducts,
  searchVariants,
  setArchived,
  updateProduct,
  updateVariant,
  type VariantInput,
} from "./products";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const phoneVariant = (over: Partial<VariantInput> = {}): VariantInput => ({
  storage: "256GB",
  color: "Titan đen",
  isSerialized: true,
  referencePrice: 20_000_000n,
  newPrice: null,
  ...over,
});

async function makeIphone() {
  return createProduct(db, {
    name: "iPhone 15 Pro Max",
    brand: "Apple",
    category: "PHONE",
    firstVariant: phoneVariant(),
  });
}

async function addDevice(variantId: string) {
  await db.device.create({ data: { variantId, imei: "490154203237518", condition: "USED", costPrice: 1n } });
}

describe("createProduct", () => {
  it("generates slug and SKU from the names", async () => {
    const { productId } = await makeIphone();
    const p = await getProduct(db, productId);
    expect(p?.slug).toBe("iphone-15-pro-max");
    expect(p?.variants[0].sku).toBe("IPHONE-15-PRO-MAX-256GB-TITAN-DEN");
    expect(p?.variants[0].referencePrice).toBe(20_000_000n);
  });

  it("keeps slug and SKU unique with numeric suffixes", async () => {
    await makeIphone();
    const second = await makeIphone();
    const p = await getProduct(db, second.productId);
    expect(p?.slug).toBe("iphone-15-pro-max-2");
    const { variantId } = await addVariant(db, second.productId, phoneVariant());
    const skus = (await getProduct(db, second.productId))?.variants.map((v) => v.sku);
    expect(skus).toContain("IPHONE-15-PRO-MAX-256GB-TITAN-DEN-2");
    expect(variantId).toBeTruthy();
  });

  it("rejects an empty name", async () => {
    await expect(
      createProduct(db, { name: "  ", brand: "Apple", category: "PHONE", firstVariant: phoneVariant() }),
    ).rejects.toThrow(CatalogRuleError);
  });
});

describe("updateProduct", () => {
  it("keeps the slug when renaming", async () => {
    const { productId } = await makeIphone();
    await updateProduct(db, productId, { name: "iPhone 15 Pro Max (VN/A)", brand: "Apple", category: "PHONE" });
    const p = await getProduct(db, productId);
    expect(p?.name).toBe("iPhone 15 Pro Max (VN/A)");
    expect(p?.slug).toBe("iphone-15-pro-max");
  });
});

describe("variants with stock", () => {
  it("cannot delete a variant that has devices, but can archive it", async () => {
    const { productId } = await makeIphone();
    const variantId = (await getProduct(db, productId))!.variants[0].id;
    await addDevice(variantId);
    await expect(deleteVariant(db, variantId)).rejects.toThrow(
      new CatalogRuleError("Biến thể đã có máy hoặc đơn hàng, chỉ có thể ẩn"),
    );
    await setArchived(db, { variantId }, true);
    expect(await searchVariants(db, "iphone 15")).toHaveLength(0);
  });

  it("can delete a variant without stock", async () => {
    const { productId } = await makeIphone();
    const { variantId } = await addVariant(db, productId, phoneVariant({ storage: "512GB" }));
    await deleteVariant(db, variantId);
    expect((await getProduct(db, productId))?.variants).toHaveLength(1);
  });

  it("cannot switch isSerialized once devices exist", async () => {
    const { productId } = await makeIphone();
    const variantId = (await getProduct(db, productId))!.variants[0].id;
    await addDevice(variantId);
    await expect(updateVariant(db, variantId, phoneVariant({ isSerialized: false }))).rejects.toThrow(
      new CatalogRuleError("Không thể đổi loại quản lý khi đã có hàng"),
    );
  });

  it("cannot switch an accessory with stock to serialized", async () => {
    const { productId } = await createProduct(db, {
      name: "Kính cường lực iPhone",
      brand: "OEM",
      category: "ACCESSORY",
      firstVariant: { isSerialized: false, referencePrice: null, newPrice: 150_000n },
    });
    const variantId = (await getProduct(db, productId))!.variants[0].id;
    await db.productVariant.update({ where: { id: variantId }, data: { stockQty: 3 } });
    await expect(
      updateVariant(db, variantId, { isSerialized: true, referencePrice: null, newPrice: 150_000n }),
    ).rejects.toThrow(new CatalogRuleError("Không thể đổi loại quản lý khi đã có hàng"));
  });

  it("updates prices of a variant", async () => {
    const { productId } = await makeIphone();
    const variantId = (await getProduct(db, productId))!.variants[0].id;
    await updateVariant(db, variantId, phoneVariant({ referencePrice: 7_200_000n, newPrice: 30_000_000n }));
    const v = (await getProduct(db, productId))!.variants[0];
    expect([v.referencePrice, v.newPrice]).toEqual([7_200_000n, 30_000_000n]);
  });
});

describe("searchVariants", () => {
  it("matches accent- and space-insensitively and can exclude accessories", async () => {
    await makeIphone();
    await createProduct(db, {
      name: "Kính cường lực iPhone",
      brand: "OEM",
      category: "ACCESSORY",
      firstVariant: { isSerialized: false, referencePrice: null, newPrice: 150_000n },
    });
    expect((await searchVariants(db, "iphone 15 pro"))[0]).toMatchObject({
      productName: "iPhone 15 Pro Max",
      label: "256GB · Titan đen",
      referencePrice: 20_000_000n,
    });
    expect(await searchVariants(db, "IPHONE15")).toHaveLength(1);
    expect(await searchVariants(db, "kinh cuong luc")).toHaveLength(1);
    expect(await searchVariants(db, "kinh cuong luc", { serializedOnly: true })).toHaveLength(0);
  });

  it("hides archived products", async () => {
    const { productId } = await makeIphone();
    await setArchived(db, { productId }, true);
    expect(await searchVariants(db, "iphone")).toHaveLength(0);
  });
});

describe("listProducts", () => {
  it("filters by category and text, hides archived unless asked, counts listed devices", async () => {
    const { productId } = await makeIphone();
    const variantId = (await getProduct(db, productId))!.variants[0].id;
    await db.device.create({ data: { variantId, imei: "356938035643809", condition: "USED", costPrice: 1n, status: "LISTED" } });
    const acc = await createProduct(db, {
      name: "Củ sạc 20W",
      brand: "OEM",
      category: "ACCESSORY",
      firstVariant: { isSerialized: false, referencePrice: null, newPrice: 250_000n },
    });

    const phones = await listProducts(db, { category: "PHONE" });
    expect(phones.map((p) => [p.name, p.variantCount, p.listedDeviceCount])).toEqual([["iPhone 15 Pro Max", 1, 1]]);
    expect((await listProducts(db, { q: "cu sac" })).map((p) => p.name)).toEqual(["Củ sạc 20W"]);

    await setArchived(db, { productId: acc.productId }, true);
    expect((await listProducts(db, {})).map((p) => p.name)).toEqual(["iPhone 15 Pro Max"]);
    expect(await listProducts(db, { includeArchived: true })).toHaveLength(2);
  });
});
