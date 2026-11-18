"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { authenticate } from "@/server/auth/login";
import { createSession, revokeSession } from "@/server/auth/session";
import { safeNextPath } from "@/lib/auth/safe-next";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "@/lib/auth/session-cookie";

export type LoginState = { error?: string };

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

/** Lấy ?next= từ trang đăng nhập đã gửi form (Referer cùng origin). safeNextPath lọc lại sau. */
async function nextFromReferer(): Promise<string | undefined> {
  const referer = (await headers()).get("referer");
  if (!referer) return undefined;
  try {
    return new URL(referer).searchParams.get("next") ?? undefined;
  } catch {
    return undefined;
  }
}

const INVALID ="Số điện thoại hoặc mật khẩu không đúng";
const LOCKED = "Đăng nhập sai quá nhiều lần, thử lại sau 15 phút";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    phone: formData.get("phone"),
    password: formData.get("password"),
    next: (formData.get("next") as string | null) ?? (await nextFromReferer()),
  });
  if (!parsed.success) return { error: INVALID };

  const result = await authenticate(prisma, parsed.data.phone, parsed.data.password);
  if (!result.ok) return { error: result.reason === "locked" ? LOCKED : INVALID };

  const { token, expiresAt } = await createSession(prisma, result.user.id);
  await setSessionCookie(token, expiresAt);
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await revokeSession(prisma, token);
  await clearSessionCookie();
  redirect("/admin/login");
}
