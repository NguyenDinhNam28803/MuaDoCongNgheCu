import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ForbiddenError, assertCan, can } from "./permissions";

describe("can", () => {
  it("OWNER has every permission", () => {
    for (const p of ALL_PERMISSIONS) expect(can("OWNER", p)).toBe(true);
  });

  it("STAFF has exactly intake, inspect and sell", () => {
    const granted = ALL_PERMISSIONS.filter((p) => can("STAFF", p));
    expect(granted.sort()).toEqual(["device.inspect", "device.intake", "order.sell"]);
    expect(ALL_PERMISSIONS).toHaveLength(9);
  });

  it("assertCan throws ForbiddenError when denied", () => {
    expect(() => assertCan("STAFF", "user.manage")).toThrow(ForbiddenError);
    expect(() => assertCan("OWNER", "user.manage")).not.toThrow();
  });
});
