// Data Access Layer cho xác thực: kiểm tra thật bằng DB, ghi nhớ trong một lượt render.
import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { prisma } from "@/server/db";
import { can, type Permission } from "@/server/auth/permissions";
import { validateSession, type SessionUser } from "@/server/auth/session";
import { readSessionCookie, setSessionCookie } from "./session-cookie";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // validateSession dùng thời gian hiện tại → đánh dấu rõ là chạy theo request (Cache Components).
  await connection();
  const token = await readSessionCookie();
  if (!token) return null;
  const result = await validateSession(prisma, token);
  if (!result) return null;
  if (result.renewed) {
    // Server Component không ghi được cookie; Server Action / Route Handler thì được.
    try {
      await setSessionCookie(token, result.expiresAt);
    } catch {
      /* gia hạn cookie ở lần gọi action kế tiếp */
    }
  }
  return result.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) notFound();
  return user;
}
