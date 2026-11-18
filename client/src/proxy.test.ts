import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("proxy", () => {
  it("redirects to login with next when the session cookie is missing", () => {
    const res = proxy(req("/admin/kho"));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toBe("http://localhost/admin/login?next=%2Fadmin%2Fkho");
  });

  it("lets the login page through without a cookie", () => {
    expect(proxy(req("/admin/login"))).toBeUndefined();
  });

  it("lets requests with a session cookie through (real check happens in the DAL)", () => {
    expect(proxy(req("/admin/kho", "session=x"))).toBeUndefined();
  });
});
