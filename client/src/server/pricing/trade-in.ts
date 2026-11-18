// Định giá thu bằng công thức minh bạch (MVP):
//   giá tham chiếu × hệ số hạng × hệ số pin − khoản trừ cố định, làm tròn xuống, có trần.
// Hệ số dùng phần nghìn (permille) để toàn bộ phép tính là số nguyên VND (BigInt).
import type { Grade } from "@/generated/prisma/enums";

export interface BatteryTier {
  /** % pin tối thiểu để áp dụng bậc này */
  minPct: number;
  permille: number;
}

export interface TradeInPricingConfig {
  gradePermille: Record<Grade, number>;
  /** Sắp xếp giảm dần theo minPct; bậc cuối nên có minPct = 0 */
  batteryTiers: BatteryTier[];
  /** Làm tròn xuống theo bội số này (VND) */
  roundTo: bigint;
}

export const DEFAULT_TRADE_IN_CONFIG: TradeInPricingConfig = {
  gradePermille: { A: 1000, B: 900, C: 750 },
  batteryTiers: [
    { minPct: 90, permille: 1000 },
    { minPct: 85, permille: 950 },
    { minPct: 80, permille: 900 },
    { minPct: 0, permille: 800 },
  ],
  roundTo: 10_000n,
};

export interface Deduction {
  label: string; // "Thiếu hộp", "Đã thay màn", "Mã vùng J/A"…
  amount: bigint;
}

export interface TradeInQuoteInput {
  referencePrice: bigint;
  grade: Grade;
  /** null = không đo được → dùng bậc thấp nhất cho an toàn */
  batteryPct: number | null;
  deductions?: Deduction[];
  /** Trần giá thu (chống định giá quá cao) */
  maxPrice?: bigint;
}

export interface TradeInQuote {
  price: bigint;
  gradePermille: number;
  batteryPermille: number;
  totalDeductions: bigint;
  capped: boolean;
}

export function batteryPermille(pct: number | null, tiers: BatteryTier[]): number {
  const lowest = tiers[tiers.length - 1];
  if (pct === null) return lowest.permille;
  return (tiers.find((t) => pct >= t.minPct) ?? lowest).permille;
}

export function quoteTradeInPrice(
  input: TradeInQuoteInput,
  config: TradeInPricingConfig = DEFAULT_TRADE_IN_CONFIG,
): TradeInQuote {
  const g = config.gradePermille[input.grade];
  const b = batteryPermille(input.batteryPct, config.batteryTiers);
  const totalDeductions = (input.deductions ?? []).reduce((sum, d) => sum + d.amount, 0n);

  let price = (input.referencePrice * BigInt(g) * BigInt(b)) / 1_000_000n - totalDeductions;
  if (price < 0n) price = 0n;
  price = (price / config.roundTo) * config.roundTo;

  let capped = false;
  if (input.maxPrice !== undefined && price > input.maxPrice) {
    price = input.maxPrice;
    capped = true;
  }

  return { price, gradePermille: g, batteryPermille: b, totalDeductions, capped };
}
