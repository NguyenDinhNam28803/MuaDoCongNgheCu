"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requirePermission } from "@/lib/auth/dal";
import { UserRuleError, changePassword, createStaff, setUserActive } from "@/server/users/service";

export type FormState = { error?: string; ok?: boolean };

const PATH = "/admin/nhan-vien";

async function run(fn: () => Promise<void>): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof UserRuleError) return { error: e.message };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("user.manage");
  return run(async () => {
    await createStaff(prisma, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  });
}

export async function setActiveAction(userId: string, active: boolean): Promise<FormState> {
  const actor = await requirePermission("user.manage");
  return run(() => setUserActive(prisma, actor.id, userId, active));
}

export async function changePasswordAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("user.manage");
  return run(() => changePassword(prisma, userId, String(formData.get("password") ?? "")));
}
