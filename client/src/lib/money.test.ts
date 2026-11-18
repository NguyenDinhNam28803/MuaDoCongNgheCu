import { describe, expect, it } from "vitest";
import { formatVnd, parseVndInput } from "./money";

describe("parseVndInput", () => {
  it.each([
    ["15500000", 15_500_000n],
    ["15.500.000", 15_500_000n],
    ["15 500 000", 15_500_000n],
    ["15tr", 15_000_000n],
    ["15,5tr", 15_500_000n],
    ["15.5 triệu", 15_500_000n],
    ["15,25 TR", 15_250_000n],
    ["500k", 500_000n],
    ["1,5k", 1_500n],
    ["0", 0n],
  ])("%s → %s", (input, expected) => {
    expect(parseVndInput(input)).toBe(expected);
  });

  it.each([[""], ["abc"], ["-5"], ["15,5"], ["15.5.5tr"], ["1.2345tr"]])("%s → null", (input) => {
    expect(parseVndInput(input)).toBeNull();
  });
});

describe("formatVnd", () => {
  it.each([
    [15_500_000n, "15.500.000 ₫"],
    [0n, "0 ₫"],
    [-1_000_000n, "-1.000.000 ₫"],
    [null, "—"],
    [undefined, "—"],
  ])("%s → %s", (input, expected) => {
    expect(formatVnd(input)).toBe(expected);
  });
});
