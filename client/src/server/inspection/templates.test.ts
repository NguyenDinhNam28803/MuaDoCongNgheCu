import { describe, expect, it } from "vitest";
import { PRODUCT_CATEGORIES } from "../catalog/schemas";
import { GRADE_CRITERIA, TEMPLATE_VERSION, checklistFor, partsFor } from "./templates";

describe("checklistFor", () => {
  it.each(PRODUCT_CATEGORIES)("%s has 6–15 items with unique keys", (category) => {
    const items = checklistFor(category);
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.length).toBeLessThanOrEqual(15);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it("phones and tablets check biometrics, display and cameras", () => {
    const keys = checklistFor("PHONE").map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["face_id", "true_tone", "camera_rear", "sim", "charging"]));
    expect(checklistFor("TABLET").map((i) => i.key)).toEqual(keys);
  });

  it("laptops check keyboard, trackpad and battery cycles", () => {
    expect(checklistFor("LAPTOP").map((i) => i.key)).toEqual(
      expect.arrayContaining(["keyboard", "trackpad", "battery_cycles", "ports"]),
    );
  });

  it("is versioned", () => {
    expect(TEMPLATE_VERSION).toBe(1);
  });
});

describe("grades and parts", () => {
  it("has written criteria for A, B, C", () => {
    expect(Object.keys(GRADE_CRITERIA)).toEqual(["A", "B", "C"]);
    for (const text of Object.values(GRADE_CRITERIA)) expect(text.length).toBeGreaterThan(20);
  });

  it("offers replaceable parts per category", () => {
    expect(partsFor("PHONE")).toContain("Màn hình");
    expect(partsFor("LAPTOP")).toContain("Bàn phím");
    expect(partsFor("ACCESSORY").length).toBeGreaterThan(0);
  });
});
