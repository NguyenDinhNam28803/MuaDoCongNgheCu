import type { Db } from "../db";
import { CatalogRuleError } from "./errors";

/** Cộng/trừ tồn phụ kiện bằng một câu UPDATE có điều kiện — không bao giờ âm, an toàn khi bán đồng thời. */
export async function adjustAccessoryStock(db: Db, variantId: string, delta: number): Promise<{ stockQty: number }> {
  if (!Number.isInteger(delta) || delta === 0) throw new CatalogRuleError("Số lượng điều chỉnh không hợp lệ");

  const { count } = await db.productVariant.updateMany({
    where: { id: variantId, isSerialized: false, ...(delta < 0 && { stockQty: { gte: -delta } }) },
    data: { stockQty: { increment: delta } },
  });

  const v = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { stockQty: true, isSerialized: true },
  });
  if (count === 0) {
    if (v.isSerialized) throw new CatalogRuleError("Máy có serial quản lý theo từng máy, không chỉnh số lượng");
    throw new CatalogRuleError("Không đủ hàng trong kho");
  }
  return { stockQty: v.stockQty };
}
