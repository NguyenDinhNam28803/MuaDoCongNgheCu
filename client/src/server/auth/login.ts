import type { Db } from "../db";
import { verifyPassword } from "./password";
import { normalizePhone } from "./phone";
import type { SessionUser } from "./session";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MINUTES = 15;

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; reason: "invalid" | "locked" };

export async function authenticate(
  db: Db,
  phoneInput: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { ok: false, reason: "invalid" };

  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000);
  const failures = await db.loginAttempt.count({
    where: { phone, success: false, createdAt: { gt: since, lte: now } },
  });

  const record = (success: boolean) => db.loginAttempt.create({ data: { phone, success, createdAt: now } });

  if (failures >= LOGIN_MAX_FAILURES) {
    await record(false);
    return { ok: false, reason: "locked" };
  }

  const user = await db.user.findUnique({ where: { phone } });
  const valid = !!user && user.active && (await verifyPassword(password, user.passwordHash));
  await record(valid);
  if (!valid || !user) return { ok: false, reason: "invalid" };

  return { ok: true, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } };
}
