// Lãi gộp theo máy:
//   P_bán − P_thu − C_tân trang − C_bảo hành dự phòng − C_phí thanh toán/vận chuyển
import type { DeviceCostType } from "@/generated/prisma/enums";

export interface CostLine {
  type: DeviceCostType;
  amount: bigint;
}

export interface GrossProfitInput {
  salePrice: bigint;
  costPrice: bigint;
  costs: CostLine[];
}

export interface GrossProfit {
  profit: bigint;
  totalCost: bigint;
  costsByType: Partial<Record<DeviceCostType, bigint>>;
}

export function grossProfit({ salePrice, costPrice, costs }: GrossProfitInput): GrossProfit {
  const costsByType: Partial<Record<DeviceCostType, bigint>> = {};
  let extra = 0n;
  for (const c of costs) {
    costsByType[c.type] = (costsByType[c.type] ?? 0n) + c.amount;
    extra += c.amount;
  }
  const totalCost = costPrice + extra;
  return { profit: salePrice - totalCost, totalCost, costsByType };
}

const DAY_MS = 86_400_000;

/** Tuổi tồn kho (ngày) — chỉ số quan trọng ngang biên lợi nhuận với máy cũ. */
export function inventoryAgeDays(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS));
}
