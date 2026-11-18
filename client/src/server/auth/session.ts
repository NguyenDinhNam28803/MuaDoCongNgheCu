// Phiên đăng nhập lưu DB. Cookie giữ token ngẫu nhiên; DB chỉ lưu SHA-256 của token.
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@/generated/prisma/enums";
import type { Db } from "../db";

export type SessionUser = { id: string; name: string; phone: string; role: Role };

export const SESSION_TTL_DAYS = 30;
export const SESSION_RENEW_BELOW_DAYS = 15;

const DAY_MS = 86_400_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * DAY_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSession(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
  if (!token) return null;
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phone: true, role: true, active: true } } },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (!session.user.active) return null;

  let expiresAt = session.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - now.getTime() < SESSION_RENEW_BELOW_DAYS * DAY_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * DAY_MS);
    await db.session.update({ where: { id }, data: { expiresAt } });
    renewed = true;
  }

  const { id: userId, name, phone, role } = session.user;
  return { user: { id: userId, name, phone, role }, expiresAt, renewed };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
