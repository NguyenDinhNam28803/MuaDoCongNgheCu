import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["iPhone 15 Pro Max", "iphone-15-pro-max"],
    ["Kính cường lực iPhone", "kinh-cuong-luc-iphone"],
    ["Đồng hồ  Galaxy Watch", "dong-ho-galaxy-watch"],
    ['MacBook Air M2 13"', "macbook-air-m2-13"],
    ["Tai nghe Bluetooth – Sony WH-1000XM5", "tai-nghe-bluetooth-sony-wh-1000xm5"],
    ["  --  ", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
