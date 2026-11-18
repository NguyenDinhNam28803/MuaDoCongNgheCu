import { describe, expect, it } from "vitest";
import { variantLabel } from "./products";

describe("variantLabel", () => {
  it.each([
    [{ ram: "8GB", storage: "256GB", color: "Titan đen" }, "8GB/256GB · Titan đen"],
    [{ storage: "256GB" }, "256GB"],
    [{ color: "Trắng" }, "Trắng"],
    [{ storage: null, ram: null, color: null }, "Mặc định"],
  ])("%o → %s", (v, expected) => {
    expect(variantLabel(v)).toBe(expected);
  });
});
