import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/server/db";
import { getShopInfo } from "@/server/shop/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Cài đặt cửa hàng" };

export default async function SettingsPage() {
  await requirePermission("user.manage");
  const info = await getShopInfo(prisma);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Cài đặt cửa hàng</h1>
        <p className="text-sm text-muted-foreground">Thông tin hiển thị trên website cho khách.</p>
      </div>
      <SettingsForm info={info} />
    </div>
  );
}
