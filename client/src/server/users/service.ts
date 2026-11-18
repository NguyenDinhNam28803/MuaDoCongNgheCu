import type { Db } from "../db";
import { hashPassword } from "../auth/password";
import { normalizePhone } from "../auth/phone";
import type { SessionUser } from "../auth/session";

export const MIN_PASSWORD_LENGTH = 8;

/** Lỗi nghiệp vụ; thông điệp hiển thị thẳng cho người dùng. */
export class UserRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserRuleError";
  }
}

export type UserListItem = SessionUser & { active: boolean; createdAt: Date };

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new UserRuleError(`Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`);
}

export async function listUsers(db: Db): Promise<UserListItem[]> {
  const rows = await db.user.findMany({
    select: { id: true, name: true, phone: true, role: true, active: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return rows;
}

export async function createStaff(
  db: Db,
  input: { name: string; phone: string; password: string },
): Promise<SessionUser> {
  const name = input.name.trim();
  if (!name) throw new UserRuleError("Vui lòng nhập tên");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new UserRuleError("Số điện thoại không hợp lệ");
  assertPassword(input.password);
  if (await db.user.findUnique({ where: { phone }, select: { id: true } })) {
    throw new UserRuleError("Số điện thoại đã được dùng");
  }

  const user = await db.user.create({
    data: { name, phone, role: "STAFF", passwordHash: await hashPassword(input.password) },
    select: { id: true, name: true, phone: true, role: true },
  });
  return user;
}

export async function setUserActive(db: Db, actorId: string, userId: string, active: boolean): Promise<void> {
  if (!active && actorId === userId) throw new UserRuleError("Không thể tự khóa tài khoản của mình");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [db.session.deleteMany({ where: { userId } })]),
  ]);
}

export async function changePassword(db: Db, userId: string, newPassword: string): Promise<void> {
  assertPassword(newPassword);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}
