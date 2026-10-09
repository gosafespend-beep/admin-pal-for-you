import { describe, expect, it } from "vitest";
import { decideUserAction, parseSuspendDays, type ActionFacts } from "./userActionRules";

const base: ActionFacts = {
  action: "suspend",
  adminId: "admin-1",
  targetId: "user-1",
  targetEmail: "person@example.com",
  targetIsAdmin: false,
  targetEmailConfirmed: true,
  adminCount: 2,
  reason: "Repeated chargeback abuse reported by support",
  data: { duration: 14 },
  confirmEmail: undefined,
  hasPaidSubscription: false,
};

const denied = (facts: Partial<ActionFacts>) => {
  const r = decideUserAction({ ...base, ...facts });
  if (r.ok) throw new Error("expected the action to be denied");
  return r;
};

describe("reasons", () => {
  it("are required for suspend, delete, promote and demote", () => {
    for (const action of ["suspend", "delete", "promote", "demote"] as const) {
      expect(denied({ action, reason: "short", targetIsAdmin: action === "demote" }).status).toBe(400);
    }
  });

  it("are not required to lift a suspension or resend a confirmation", () => {
    expect(decideUserAction({ ...base, action: "unsuspend", reason: undefined }).ok).toBe(true);
    expect(
      decideUserAction({ ...base, action: "resend_confirmation", reason: undefined, targetEmailConfirmed: false }).ok,
    ).toBe(true);
  });
});

describe("suspend", () => {
  it("accepts a sensible duration and returns it", () => {
    const r = decideUserAction(base);
    expect(r).toMatchObject({ ok: true, suspendDays: 14 });
  });

  it("defaults to 30 days when none is given", () => {
    expect(parseSuspendDays(undefined)).toBe(30);
    expect(parseSuspendDays({})).toBe(30);
  });

  it("rejects non-integers, zero, negatives and absurdly long bans", () => {
    for (const duration of [0, -3, 1.5, 400, "abc", "1d; drop"]) {
      expect(denied({ data: { duration } }).status).toBe(400);
    }
  });

  it("refuses to suspend yourself or another admin", () => {
    expect(denied({ targetId: "admin-1" }).error).toMatch(/own account/);
    expect(denied({ targetIsAdmin: true }).status).toBe(409);
  });
});

describe("delete", () => {
  const del = { action: "delete" as const, confirmEmail: "person@example.com" };

  it("requires the exact email typed back (case-insensitive)", () => {
    expect(decideUserAction({ ...base, ...del }).ok).toBe(true);
    expect(decideUserAction({ ...base, ...del, confirmEmail: " PERSON@example.com " }).ok).toBe(true);
    expect(denied({ ...del, confirmEmail: "someone@else.com" }).status).toBe(400);
    expect(denied({ ...del, confirmEmail: undefined }).status).toBe(400);
  });

  it("refuses to delete yourself, an admin, or a paying subscriber", () => {
    expect(denied({ ...del, targetId: "admin-1" }).error).toMatch(/own account/);
    expect(denied({ ...del, targetIsAdmin: true }).status).toBe(409);
    expect(denied({ ...del, hasPaidSubscription: true }).error).toMatch(/paid subscription/);
  });
});

describe("promote and demote", () => {
  it("only promotes confirmed, non-admin users", () => {
    expect(decideUserAction({ ...base, action: "promote" }).ok).toBe(true);
    expect(denied({ action: "promote", targetIsAdmin: true }).status).toBe(409);
    expect(denied({ action: "promote", targetEmailConfirmed: false }).status).toBe(409);
  });

  it("never lets an admin remove themselves or the last admin", () => {
    expect(denied({ action: "demote", targetIsAdmin: true, targetId: "admin-1" }).error).toMatch(/own admin/);
    expect(denied({ action: "demote", targetIsAdmin: true, adminCount: 1 }).error).toMatch(/last admin/);
    expect(decideUserAction({ ...base, action: "demote", targetIsAdmin: true, adminCount: 2 }).ok).toBe(true);
  });
});

describe("revoke_session", () => {
  const sessionId = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("needs a valid session id but no written reason", () => {
    const r = decideUserAction({ ...base, action: "revoke_session", reason: undefined, data: { sessionId } });
    expect(r).toMatchObject({ ok: true, sessionId });
    expect(denied({ action: "revoke_session", data: { sessionId: "nope" } }).status).toBe(400);
    expect(denied({ action: "revoke_session", data: null }).status).toBe(400);
  });
});

describe("unknown actions", () => {
  it("are rejected", () => {
    expect(denied({ action: "ban_forever" }).status).toBe(400);
  });
});
