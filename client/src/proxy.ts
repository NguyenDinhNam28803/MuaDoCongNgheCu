// Kiểm tra LẠC QUAN: chỉ xem có cookie phiên hay không, không gọi DB.
// Kiểm tra thật (phiên còn hạn, tài khoản còn hoạt động, quyền) nằm ở src/lib/auth/dal.ts.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "session";
const LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  if (pathname === LOGIN_PATH) return undefined;
  if (request.cookies.has(SESSION_COOKIE)) return undefined;

  const url = new URL(LOGIN_PATH, request.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
