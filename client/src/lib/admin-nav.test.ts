import { describe, expect, it } from "vitest";
import { navItemsFor } from "./admin-nav";

describe("navItemsFor", () => {
  it("STAFF sees only shared items", () => {
    expect(navItemsFor("STAFF").map((i) => i.href)).toEqual([
      "/admin",
      "/admin/kho",
      "/admin/nhap-may",
      "/admin/ban-hang",
      "/admin/don-hang",
    ]);
  });

  it("OWNER also sees reports, catalog and staff after the shared items", () => {
    expect(navItemsFor("OWNER").map((i) => i.href)).toEqual([
      "/admin",
      "/admin/kho",
      "/admin/nhap-may",
      "/admin/ban-hang",
      "/admin/don-hang",
      "/admin/bao-cao",
      "/admin/catalog",
      "/admin/nhan-vien",
      "/admin/cai-dat",
    ]);
  });
});
