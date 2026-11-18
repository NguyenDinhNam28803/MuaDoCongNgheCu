import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, resetDb, testDb as db } from "../../../test/db";
import { authenticate } from "./login";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const PHONE = "0900000000";
const MIN = 60_000;

async function failTimes(n: number, now: Date) {
  for (let i = 0; i < n; i++) await authenticate(db, PHONE, "sai-mat-khau", now);
}

describe("authenticate", () => {
  it("accepts a correctly formatted variant of the phone", async () => {
    await createUser({ phone: PHONE, password: "doimatkhau" });
    const r = await authenticate(db, "+84 900 000 000", "doimatkhau");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.phone).toBe(PHONE);
  });

  it("returns invalid for a wrong password and for an unknown phone", async () => {
    await createUser({ phone: PHONE });
    expect(await authenticate(db, PHONE, "sai")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate(db, "0911111111", "doimatkhau")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after 5 failures within 15 minutes even with the right password", async () => {
    await createUser({ phone: PHONE, password: "doimatkhau" });
    const now = new Date("2026-11-14T08:00:00Z");
    await failTimes(5, now);
    expect(await authenticate(db, PHONE, "doimatkhau", new Date(now.getTime() + MIN))).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("unlocks after the window passes", async () => {
    await createUser({ phone: PHONE, password: "doimatkhau" });
    const now = new Date("2026-11-14T08:00:00Z");
    await failTimes(5, now);
    const r = await authenticate(db, PHONE, "doimatkhau", new Date(now.getTime() + 16 * MIN));
    expect(r.ok).toBe(true);
  });

  it("rejects a deactivated user with the right password", async () => {
    await createUser({ phone: PHONE, password: "doimatkhau", active: false });
    expect(await authenticate(db, PHONE, "doimatkhau")).toEqual({ ok: false, reason: "invalid" });
  });

  it("records exactly one attempt per call", async () => {
    await createUser({ phone: PHONE, password: "doimatkhau" });
    await authenticate(db, PHONE, "sai");
    await authenticate(db, PHONE, "doimatkhau");
    const attempts = await db.loginAttempt.findMany({ orderBy: { createdAt: "asc" } });
    expect(attempts.map((a) => [a.phone, a.success])).toEqual([
      [PHONE, false],
      [PHONE, true],
    ]);
  });
});
