import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import { createSession, revokeAllSessions, revokeSession, validateSession } from "./session";

const DAY = 86_400_000;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("createSession", () => {
  it("stores only the SHA-256 of a random token", async () => {
    const user = await createUser();
    const { token, expiresAt } = await createSession(db, user.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    const rows = await db.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sha(token));
    expect(rows[0].id).not.toContain(token);
    expect(expiresAt.getTime()).toBe(rows[0].expiresAt.getTime());
  });
});

describe("validateSession", () => {
  it("returns the user for a fresh session without renewing", async () => {
    const user = await createUser({ role: "OWNER" });
    const now = new Date("2026-11-14T00:00:00Z");
    const { token } = await createSession(db, user.id, now);
    const r = await validateSession(db, token, now);
    expect(r?.user).toEqual({ id: user.id, name: user.name, phone: user.phone, role: "OWNER" });
    expect(r?.renewed).toBe(false);
  });

  it("expires and deletes the session after 30 days", async () => {
    const user = await createUser();
    const now = new Date("2026-11-14T00:00:00Z");
    const { token } = await createSession(db, user.id, now);
    expect(await validateSession(db, token, new Date(now.getTime() + 31 * DAY))).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("slides the expiry when fewer than 15 days remain", async () => {
    const user = await createUser();
    const now = new Date("2026-11-14T00:00:00Z");
    const { token } = await createSession(db, user.id, now);
    const later = new Date(now.getTime() + 20 * DAY);
    const r = await validateSession(db, token, later);
    expect(r?.renewed).toBe(true);
    expect(r?.expiresAt.getTime()).toBe(later.getTime() + 30 * DAY);
    expect((await db.session.findFirstOrThrow()).expiresAt.getTime()).toBe(later.getTime() + 30 * DAY);
  });

  it("rejects unknown and empty tokens", async () => {
    expect(await validateSession(db, "khong-ton-tai")).toBeNull();
    expect(await validateSession(db, "")).toBeNull();
  });

  it("rejects a session of a deactivated user", async () => {
    const user = await createUser();
    const { token } = await createSession(db, user.id);
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    expect(await validateSession(db, token)).toBeNull();
  });
});

describe("revoke", () => {
  it("revokeSession removes one session", async () => {
    const user = await createUser();
    const a = await createSession(db, user.id);
    const b = await createSession(db, user.id);
    await revokeSession(db, a.token);
    expect(await validateSession(db, a.token)).toBeNull();
    expect(await validateSession(db, b.token)).not.toBeNull();
  });

  it("revokeAllSessions removes only that user's sessions", async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    await createSession(db, u1.id);
    await createSession(db, u1.id);
    const other = await createSession(db, u2.id);
    await revokeAllSessions(db, u1.id);
    expect(await db.session.count({ where: { userId: u1.id } })).toBe(0);
    expect(await validateSession(db, other.token)).not.toBeNull();
  });
});
