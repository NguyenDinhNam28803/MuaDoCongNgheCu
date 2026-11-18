import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifies the right password only", async () => {
    const stored = await hashPassword("doimatkhau");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("doimatkhau", stored)).toBe(true);
    expect(await verifyPassword("sai", stored)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "plain")).toBe(false);
  });
});
