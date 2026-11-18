import { describe, expect, it } from "vitest";
import { grossProfit, inventoryAgeDays } from "./profit";

describe("grossProfit", () => {
  it("subtracts cost price and every cost line", () => {
    const r = grossProfit({
      salePrice: 15_000_000n,
      costPrice: 11_000_000n,
      costs: [
        { type: "REFURBISH", amount: 800_000n },
        { type: "REFURBISH", amount: 200_000n },
        { type: "WARRANTY_RESERVE", amount: 300_000n },
        { type: "SHIPPING", amount: 50_000n },
      ],
    });
    expect(r.totalCost).toBe(12_350_000n);
    expect(r.profit).toBe(2_650_000n);
    expect(r.costsByType.REFURBISH).toBe(1_000_000n);
  });

  it("can be negative (máy lỗ)", () => {
    expect(grossProfit({ salePrice: 9_000_000n, costPrice: 10_000_000n, costs: [] }).profit).toBe(-1_000_000n);
  });
});

describe("inventoryAgeDays", () => {
  it("counts whole days", () => {
    const since = new Date("2026-11-01T10:00:00Z");
    expect(inventoryAgeDays(since, new Date("2026-11-13T09:59:59Z"))).toBe(11);
    expect(inventoryAgeDays(since, new Date("2026-11-13T10:00:00Z"))).toBe(12);
  });

  it("never negative", () => {
    expect(inventoryAgeDays(new Date("2026-12-01"), new Date("2026-11-01"))).toBe(0);
  });
});
