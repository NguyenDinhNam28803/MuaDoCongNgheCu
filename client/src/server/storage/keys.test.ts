import { describe, expect, it } from "vitest";
import { buildPhotoKey, isKeyOfKind } from "./keys";

describe("buildPhotoKey", () => {
  it("builds id-doc keys under id-docs/YYYY/MM", () => {
    expect(buildPhotoKey("id-doc", new Date("2026-11-14T00:00:00Z"))).toMatch(/^id-docs\/2026\/11\/[a-f0-9]{24}\.webp$/);
  });

  it("builds device keys under devices/YYYY/MM and never repeats", () => {
    const a = buildPhotoKey("device", new Date("2026-01-05T00:00:00Z"));
    const b = buildPhotoKey("device", new Date("2026-01-05T00:00:00Z"));
    expect(a).toMatch(/^devices\/2026\/01\/[a-f0-9]{24}\.webp$/);
    expect(a).not.toBe(b);
  });
});

describe("isKeyOfKind", () => {
  it.each([
    ["id-docs/2026/11/abcdef0123456789abcdef01.webp", "id-doc", true],
    ["devices/2026/11/abcdef0123456789abcdef01.webp", "device", true],
    ["id-docs/2026/11/abcdef0123456789abcdef01.webp", "device", false],
    ["id-docs/../devices/x.webp", "id-doc", false],
    ["id-docs/2026/11/x.webp", "id-doc", false],
    ["/id-docs/2026/11/abcdef0123456789abcdef01.webp", "id-doc", false],
  ] as const)("%s as %s → %s", (key, kind, expected) => {
    expect(isKeyOfKind(key, kind)).toBe(expected);
  });
});
