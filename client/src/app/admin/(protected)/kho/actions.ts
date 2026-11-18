"use server";

import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { ForbiddenError } from "@/server/auth/permissions";
import { getIdDocViewUrl } from "@/server/inventory/queries";

/** URL ký 5 phút để chủ cửa hàng xem ảnh giấy tờ người bán. */
export async function viewIdDocAction(deviceId: string): Promise<{ url: string } | { error: string }> {
  const user = await requireUser();
  try {
    const url = await getIdDocViewUrl(prisma, user, deviceId);
    return url ? { url } : { error: "Máy này không có ảnh giấy tờ" };
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}
