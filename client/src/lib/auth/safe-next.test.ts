import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each([
    ["/admin/kho", "/admin/kho"],
    ["/admin", "/admin"],
    ["/admin/kho/abc-123", "/admin/kho/abc-123"],
    [null, "/admin"],
    [undefined, "/admin"],
    ["//evil.com", "/admin"],
    ["https://evil.com", "/admin"],
    ["/adminx", "/admin"],
    ["/admin/../api", "/admin"],
    ["/\\evil.com", "/admin"],
    ["/admin/kho?x=1", "/admin"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
