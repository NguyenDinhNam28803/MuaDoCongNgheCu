import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import { authenticate } from "../auth/login";
import { verifyPassword } from "../auth/password";
import { createSession, validateSession } from "../auth/session";
import { UserRuleError, changePassword, createStaff, listUsers, setUserActive } from "./service";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("createStaff", () => {
  it("normalizes the phone, sets STAFF and hashes the password", async () => {
    const u = await createStaff(db, { name: "Nhân viên B", phone: "090 111 2222", password: "matkhau123" });
    expect(u.phone).toBe("0901112222");
    expect(u.role).toBe("STAFF");
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await verifyPassword("matkhau123", row.passwordHash)).toBe(true);
  });

  it("rejects a duplicate phone", async () => {
    await createUser({ phone: "0901112222" });
    await expect(createStaff(db, { name: "X", phone: "0901112222", password: "matkhau123" })).rejects.toThrow(
      new UserRuleError("Số điện thoại đã được dùng"),
    );
  });

  it("rejects an invalid phone", async () => {
    await expect(createStaff(db, { name: "X", phone: "123", password: "matkhau123" })).rejects.toThrow(
      new UserRuleError("Số điện thoại không hợp lệ"),
    );
  });

  it("rejects a 7-character password", async () => {
    await expect(createStaff(db, { name: "X", phone: "0901112222", password: "1234567" })).rejects.toThrow(
      new UserRuleError("Mật khẩu tối thiểu 8 ký tự"),
    );
  });

  it("rejects an empty name", async () => {
    await expect(createStaff(db, { name: "  ", phone: "0901112222", password: "matkhau123" })).rejects.toThrow(
      new UserRuleError("Vui lòng nhập tên"),
    );
  });
});

describe("setUserActive", () => {
  it("deactivating revokes every session of that user", async () => {
    const owner = await createUser({ role: "OWNER" });
    const staff = await createUser({ role: "STAFF" });
    const { token } = await createSession(db, staff.id);
    await setUserActive(db, owner.id, staff.id, false);
    expect(await db.session.count({ where: { userId: staff.id } })).toBe(0);
    expect(await validateSession(db, token)).toBeNull();
    await setUserActive(db, owner.id, staff.id, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).active).toBe(true);
  });

  it("an owner cannot deactivate themselves", async () => {
    const owner = await createUser({ role: "OWNER" });
    await expect(setUserActive(db, owner.id, owner.id, false)).rejects.toThrow(
      new UserRuleError("Không thể tự khóa tài khoản của mình"),
    );
  });
});

describe("changePassword", () => {
  it("revokes old sessions and the new password works", async () => {
    const staff = await createUser({ role: "STAFF", phone: "0912345678", password: "cu-matkhau" });
    const { token } = await createSession(db, staff.id);
    await changePassword(db, staff.id, "moi-matkhau");
    expect(await validateSession(db, token)).toBeNull();
    expect((await authenticate(db, "0912345678", "moi-matkhau")).ok).toBe(true);
  });

  it("enforces the minimum length", async () => {
    const staff = await createUser();
    await expect(changePassword(db, staff.id, "ngan")).rejects.toThrow(new UserRuleError("Mật khẩu tối thiểu 8 ký tự"));
  });
});

describe("listUsers", () => {
  it("lists owners first, then by name, with active flag", async () => {
    await createUser({ role: "STAFF", name: "B nhân viên" });
    await createUser({ role: "OWNER", name: "Chủ" });
    await createUser({ role: "STAFF", name: "A nhân viên", active: false });
    const rows = await listUsers(db);
    expect(rows.map((r) => [r.name, r.role, r.active])).toEqual([
      ["Chủ", "OWNER", true],
      ["A nhân viên", "STAFF", false],
      ["B nhân viên", "STAFF", true],
    ]);
    expect(rows[0]).not.toHaveProperty("passwordHash");
  });
});
