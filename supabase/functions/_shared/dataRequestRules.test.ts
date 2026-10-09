import { describe, expect, it } from "vitest";
import { decideRequestAction, dueState, validateNewRequest, type RequestFacts } from "./dataRequestRules";

const NOW = new Date("2026-10-09T12:00:00Z");
const base: RequestFacts = {
  type: "export",
  status: "received",
  identityVerifiedAt: null,
  exportGeneratedAt: null,
  hasSubject: true,
  subjectStillExists: true,
};
const verified = { ...base, status: "in_progress" as const, identityVerifiedAt: "2026-10-09T10:00:00Z" };
const denied = (action: string, f: RequestFacts, input = {}) => {
  const r = decideRequestAction(action, f, input);
  if (r.ok) throw new Error("expected denial");
  return r;
};

describe("validateNewRequest", () => {
  it("defaults to email, now and a 30-day deadline", () => {
    const r = validateNewRequest({ type: "export", requesterEmail: " Person@Example.com " }, NOW);
    expect(r.ok && r.value.email).toBe("person@example.com");
    expect(r.ok && r.value.dueAt.toISOString()).toBe("2026-11-08T12:00:00.000Z");
    expect(r.ok && r.value.channel).toBe("email");
  });

  it("counts the deadline from when the request was received, not when it was logged", () => {
    const r = validateNewRequest({ type: "delete", requesterEmail: "a@b.co", receivedAt: "2026-10-01T00:00:00Z", dueDays: 14 }, NOW);
    expect(r.ok && r.value.dueAt.toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("rejects bad input", () => {
    for (const input of [
      { type: "nope", requesterEmail: "a@b.co" },
      { type: "export", requesterEmail: "not an email" },
      { type: "export", requesterEmail: "a@b.co", channel: "carrier pigeon" },
      { type: "export", requesterEmail: "a@b.co", dueDays: 0 },
      { type: "export", requesterEmail: "a@b.co", dueDays: 91 },
      { type: "export", requesterEmail: "a@b.co", dueDays: 1.5 },
      { type: "export", requesterEmail: "a@b.co", receivedAt: "2099-01-01" },
      { type: "export", requesterEmail: "a@b.co", receivedAt: "2020-01-01" },
      { type: "export", requesterEmail: "a@b.co", receivedAt: "garbage" },
    ]) {
      expect(validateNewRequest(input, NOW).ok).toBe(false);
    }
  });
});

describe("verify", () => {
  it("needs a note about how identity was confirmed", () => {
    expect(denied("verify", base, { note: "ok" }).status).toBe(400);
    expect(decideRequestAction("verify", base, { note: "Replied from the registered email" }).ok).toBe(true);
  });

  it("can't be done twice", () => {
    expect(denied("verify", verified, { note: "again please" }).status).toBe(409);
  });
});

describe("export", () => {
  it("only after verification, only for export requests, only with a matching account", () => {
    expect(denied("export", base).error).toMatch(/Verify/);
    expect(denied("export", { ...verified, type: "delete" }).status).toBe(409);
    expect(denied("export", { ...verified, hasSubject: false }).error).toMatch(/No account/);
    expect(decideRequestAction("export", verified).ok).toBe(true);
  });
});

describe("complete", () => {
  it("export: needs verification and a generated export", () => {
    expect(denied("complete", base).error).toMatch(/Verify/);
    expect(denied("complete", verified).error).toMatch(/Generate the export/);
    expect(decideRequestAction("complete", { ...verified, exportGeneratedAt: "2026-10-09T11:00:00Z" }).ok).toBe(true);
  });

  it("delete: the account must be gone, or never have existed", () => {
    const del = { ...verified, type: "delete" as const };
    expect(denied("complete", del).error).toMatch(/still exists/);
    expect(decideRequestAction("complete", { ...del, subjectStillExists: false }).ok).toBe(true);
    expect(decideRequestAction("complete", { ...del, hasSubject: false, subjectStillExists: false }).ok).toBe(true);
  });

  it("rectify, opt-out and other: describe what was done", () => {
    for (const type of ["rectify", "opt_out"] as const) {
      expect(denied("complete", { ...verified, type }).status).toBe(400);
      expect(decideRequestAction("complete", { ...verified, type }, { resolution: "Unsubscribed from marketing" }).ok).toBe(true);
    }
    expect(decideRequestAction("complete", { ...base, type: "other" }, { resolution: "Answered by email" }).ok).toBe(true);
  });
});

describe("reject", () => {
  it("always needs a reason, even before verification", () => {
    expect(denied("reject", base, { resolution: "no" }).status).toBe(400);
    expect(decideRequestAction("reject", base, { resolution: "Could not verify the requester" }).ok).toBe(true);
  });
});

describe("closed requests", () => {
  it("accept no further action", () => {
    for (const status of ["completed", "rejected"] as const) {
      expect(denied("verify", { ...verified, status }, { note: "later" }).error).toMatch(/closed/);
    }
    expect(denied("explode", base).status).toBe(400);
  });
});

describe("dueState", () => {
  it("reports days left, urgency and lateness", () => {
    expect(dueState("2026-11-08T12:00:00Z", "received", NOW)).toEqual({ tone: "ok", days: 30 });
    expect(dueState("2026-10-14T12:00:00Z", "in_progress", NOW)).toEqual({ tone: "soon", days: 5 });
    expect(dueState("2026-10-06T12:00:00Z", "received", NOW)).toEqual({ tone: "overdue", days: 3 });
    expect(dueState("2026-10-01T00:00:00Z", "completed", NOW).tone).toBe("closed");
  });
});
