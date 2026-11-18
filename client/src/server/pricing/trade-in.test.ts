import { describe, expect, it } from "vitest";
import { DEFAULT_TRADE_IN_CONFIG, batteryPermille, quoteTradeInPrice } from "./trade-in";

describe("batteryPermille", () => {
  const tiers = DEFAULT_TRADE_IN_CONFIG.batteryTiers;
  it.each([
    [100, 1000],
    [90, 1000],
    [89, 950],
    [85, 950],
    [80, 900],
    [79, 800],
    [0, 800],
  ])("%i%% → %i‰", (pct, expected) => {
    expect(batteryPermille(pct, tiers)).toBe(expected);
  });

  it("unknown battery uses the lowest tier", () => {
    expect(batteryPermille(null, tiers)).toBe(800);
  });
});

describe("quoteTradeInPrice", () => {
  it("grade A, good battery, no deductions = reference price", () => {
    const q = quoteTradeInPrice({ referencePrice: 20_000_000n, grade: "A", batteryPct: 95 });
    expect(q.price).toBe(20_000_000n);
  });

  it("applies grade × battery − deductions and rounds down to 10,000", () => {
    // 20,000,000 × 0.9 × 0.95 = 17,100,000 − 500,000 − 123,456 = 16,476,544 → 16,470,000
    const q = quoteTradeInPrice({
      referencePrice: 20_000_000n,
      grade: "B",
      batteryPct: 86,
      deductions: [
        { label: "Thiếu hộp", amount: 500_000n },
        { label: "Khác", amount: 123_456n },
      ],
    });
    expect(q.price).toBe(16_470_000n);
    expect(q.totalDeductions).toBe(623_456n);
    expect(q.capped).toBe(false);
  });

  it("never goes negative", () => {
    const q = quoteTradeInPrice({
      referencePrice: 1_000_000n,
      grade: "C",
      batteryPct: 50,
      deductions: [{ label: "Đã thay màn", amount: 5_000_000n }],
    });
    expect(q.price).toBe(0n);
  });

  it("respects the price cap", () => {
    const q = quoteTradeInPrice({
      referencePrice: 20_000_000n,
      grade: "A",
      batteryPct: 100,
      maxPrice: 18_000_000n,
    });
    expect(q.price).toBe(18_000_000n);
    expect(q.capped).toBe(true);
  });
});
