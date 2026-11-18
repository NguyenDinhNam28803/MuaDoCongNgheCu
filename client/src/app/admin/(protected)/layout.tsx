import type { Metadata } from "next";
import { Suspense } from "react";
import { navItemsFor } from "@/lib/admin-nav";
import { requireUser } from "@/lib/auth/dal";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const ROLE_LABEL = { OWNER: "Chủ cửa hàng", STAFF: "Nhân viên" } as const;

// Đọc phiên là dữ liệu theo request → để trong Suspense, không await ở cấp layout (Cache Components).
export default function ProtectedLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Đang tải…</div>}>
      <AdminChrome>{children}</AdminChrome>
    </Suspense>
  );
}

async function AdminChrome({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user.role).map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminNav items={items} userName={user.name} roleLabel={ROLE_LABEL[user.role]} />
      <main className="flex-1 px-4 pt-4 pb-24 md:pb-8 md:pl-8">{children}</main>
    </div>
  );
}
