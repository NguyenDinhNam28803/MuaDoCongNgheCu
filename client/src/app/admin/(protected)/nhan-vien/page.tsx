import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { listUsers } from "@/server/users/service";
import { requirePermission } from "@/lib/auth/dal";
import { AddStaffForm } from "./add-staff-form";
import { UserRow } from "./user-row";

export const metadata: Metadata = { title: "Nhân viên" };

const ROLE_LABEL = { OWNER: "Chủ cửa hàng", STAFF: "Nhân viên" } as const;

export default async function StaffPage() {
  const me = await requirePermission("user.manage");
  const users = await listUsers(prisma);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Nhân viên</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Tài khoản</h2>
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              id={u.id}
              name={u.name}
              phone={u.phone}
              roleLabel={ROLE_LABEL[u.role]}
              active={u.active}
              isSelf={u.id === me.id}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">Thêm nhân viên</h2>
        <AddStaffForm />
      </section>
    </div>
  );
}
