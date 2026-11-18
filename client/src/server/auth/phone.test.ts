import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["0900000000", "0900000000"],
    ["090 000 0000", "0900000000"],
    ["0900.000.000", "0900000000"],
    ["+84 900 000 000", "0900000000"],
    ["84900000000", "0900000000"],
    ["900000000", null],
    ["abc", null],
    ["012345678901", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});
