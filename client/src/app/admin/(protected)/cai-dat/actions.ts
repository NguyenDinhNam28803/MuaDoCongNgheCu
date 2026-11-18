"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { ShopSettingError, saveShopInfo } from "@/server/shop/settings";

export type FormState = { error?: string; ok?: boolean };

export async function saveShopInfoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("user.manage");
  const text = (k: string) => String(fd.get(k) ?? "");
  const days = Number(text("warrantyUsedDays"));
  try {
    await saveShopInfo(prisma, {
      name: text("name"),
      phone: text("phone"),
      zalo: text("zalo"),
      address: text("address"),
      hours: text("hours"),
      warrantyUsedDays: Number.isFinite(days) ? days : -1,
      warrantyText: text("warrantyText"),
      returnText: text("returnText"),
    });
  } catch (e) {
    if (e instanceof ShopSettingError) return { error: e.message };
    throw e;
  }
  updateTag("shop");
  revalidatePath("/admin/cai-dat");
  return { ok: true };
}
