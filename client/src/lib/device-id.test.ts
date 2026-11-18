import { describe, expect, it } from "vitest";
import { extractImei, isValidImei, normalizeImei, normalizeSerial, parseIdentifier } from "./device-id";

describe("isValidImei", () => {
  it.each([
    ["490154203237518", true],
    ["356938035643809", true],
    ["490154203237519", false],
    ["49015420323751", false],
    ["4901542032375180", false],
  ])("%s → %s", (imei, expected) => {
    expect(isValidImei(imei)).toBe(expected);
  });
});

describe("normalizeImei", () => {
  it.each([
    ["49 015420 323751 8", "490154203237518"],
    ["4901-5420-3237-518", "490154203237518"],
    ["490154203237519", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeImei(input)).toBe(expected);
  });
});

describe("extractImei", () => {
  it.each([
    ["IMEI: 49 015420 323751 8", "490154203237518"],
    ["490154203237518/356938035643809", "490154203237518"],
    ["IMEI1 490154203237518 IMEI2 356938035643809", "490154203237518"],
    ["490154203237518 356938035643809", "490154203237518"],
    ["490154203237519 356938035643809", "356938035643809"],
    ["hello", null],
  ])("%s → %s", (input, expected) => {
    expect(extractImei(input)).toBe(expected);
  });
});

describe("normalizeSerial", () => {
  it.each([
    [" c02xg1-abjg5h ", "C02XG1ABJG5H"],
    ["SN: FVFXC2ABCDEF", "FVFXC2ABCDEF"],
    ["abc", null],
    ["A".repeat(21), null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSerial(input)).toBe(expected);
  });
});

describe("parseIdentifier", () => {
  it.each([
    ["490154203237518", { imei: "490154203237518" }],
    ["IMEI: 49 015420 323751 8", { imei: "490154203237518" }],
    ["490154203237519", { error: "IMEI không hợp lệ" }],
    ["C02XG1-ABJG5H", { serial: "C02XG1ABJG5H" }],
    ["", { error: "Nhập IMEI hoặc serial" }],
    ["abc", { error: "IMEI/serial không hợp lệ" }],
  ])("%s → %o", (input, expected) => {
    expect(parseIdentifier(input)).toEqual(expected);
  });
});
