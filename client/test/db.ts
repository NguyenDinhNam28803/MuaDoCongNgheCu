// Tiện ích cho test tích hợp (*.db.test.ts). Chỉ dùng DB test.
import { createPrismaClient } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";

export const testDb = createPrismaClient(process.env.TEST_DATABASE_URL);

/** Xóa sạch dữ liệu mọi bảng (giữ bảng migration). */
export async function resetDb(): Promise<void> {
  const rows = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let phoneSeq = 0;

export async function createUser(
  opts: { role?: "OWNER" | "STAFF"; phone?: string; password?: string; active?: boolean; name?: string } = {},
) {
  phoneSeq++;
  return testDb.user.create({
    data: {
      name: opts.name ?? `Người dùng ${phoneSeq}`,
      phone: opts.phone ?? `09${String(10_000_000 + phoneSeq).slice(-8)}`,
      passwordHash: await hashPassword(opts.password ?? "doimatkhau"),
      role: opts.role ?? "OWNER",
      active: opts.active ?? true,
    },
  });
}
