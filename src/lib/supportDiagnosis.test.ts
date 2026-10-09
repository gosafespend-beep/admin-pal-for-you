import { describe, expect, it } from "vitest";
import { diagnose, type DiagnosisInput } from "./supportDiagnosis";

const NOW = new Date("2026-10-09T12:00:00Z");
const healthy: DiagnosisInput = {
  user: { email_confirmed_at: "2026-09-01T00:00:00Z", banned_until: null, last_sign_in_at: "2026-10-08T00:00:00Z" },
  subscription: null,
  entitlements: [],
  milestones: { onboardingComplete: null },
  totalTransactions: 0,
  marketingEmails: true,
  snapshot: { enforcementOn: false, isPremium: false, graceUntil: null, canWrite: true },
};
const ids = (i: Partial<DiagnosisInput>) => diagnose({ ...healthy, ...i }, NOW).map((f) => f.id);

describe("diagnose", () => {
  it("says so when nothing is wrong", () => {
    const f = diagnose(healthy, NOW);
    expect(f.map((x) => x.id)).toEqual(["write-open", "nothing"]);
    expect(f.at(-1)?.severity).toBe("ok");
  });

  it("flags a suspension only while it lasts", () => {
    expect(ids({ user: { ...healthy.user, banned_until: "2026-12-01T00:00:00Z" } })).toContain("suspended");
    expect(ids({ user: { ...healthy.user, banned_until: "2026-01-01T00:00:00Z" } })).not.toContain("suspended");
  });

  it("flags an unconfirmed email and orders problems first", () => {
    const f = diagnose({ ...healthy, user: { ...healthy.user, email_confirmed_at: null }, marketingEmails: false }, NOW);
    expect(f[0].id).toBe("unconfirmed");
    expect(f[0].severity).toBe("problem");
    expect(f.map((x) => x.severity)).toEqual([...f.map((x) => x.severity)].sort((a, b) => "problem warning info ok".indexOf(a) - "problem warning info ok".indexOf(b)));
  });

  it("explains the app's own write decision", () => {
    expect(ids({ snapshot: { enforcementOn: true, isPremium: false, graceUntil: null, canWrite: false } })).toContain("write-blocked");
    expect(ids({ snapshot: { enforcementOn: true, isPremium: false, graceUntil: "2026-11-01T00:00:00Z", canWrite: true } })).toContain("write-grace");
    expect(ids({ snapshot: { enforcementOn: true, isPremium: true, graceUntil: null, canWrite: true } })).toEqual(["nothing"]);
    expect(ids({ snapshot: null })).toEqual(["nothing"]);
  });

  it("spots an ended trial, but not when a store subscription is active", () => {
    const sub = { status: "trialing", trial_end: "2026-10-01T00:00:00Z", current_period_end: null, cancelled_at: null };
    expect(ids({ subscription: sub })).toContain("trial-ended");
    expect(ids({ subscription: sub, entitlements: [{ is_active: true, expires_at: "2027-01-01T00:00:00Z", store: "app_store" }] })).not.toContain("trial-ended");
    expect(ids({ subscription: { ...sub, trial_end: "2026-10-20T00:00:00Z" } })).not.toContain("trial-ended");
  });

  it("spots a lapsed paid period and a cancellation", () => {
    const active = { status: "active", trial_end: null, current_period_end: "2026-09-30T00:00:00Z", cancelled_at: null };
    expect(ids({ subscription: active })).toContain("period-lapsed");
    const cancelled = { ...active, current_period_end: "2026-11-30T00:00:00Z", cancelled_at: "2026-10-02T00:00:00Z" };
    expect(ids({ subscription: cancelled })).toContain("cancelled");
    expect(ids({ subscription: cancelled })).not.toContain("period-lapsed");
  });

  it("spots a store entitlement that should have expired", () => {
    expect(ids({ entitlements: [{ is_active: true, expires_at: "2026-09-01T00:00:00Z", store: "play_store" }] })).toContain("store-stale-play_store");
    expect(ids({ entitlements: [{ is_active: true, expires_at: null, store: "play_store" }] })).not.toContain("store-stale-play_store");
  });

  it("notes inactivity, a missing first transaction and marketing opt-out", () => {
    expect(ids({ user: { ...healthy.user, last_sign_in_at: null } })).toContain("never-signed-in");
    expect(ids({ user: { ...healthy.user, last_sign_in_at: "2026-08-01T00:00:00Z" } })).toContain("dormant");
    expect(ids({ milestones: { onboardingComplete: "2026-09-02T00:00:00Z" } })).toContain("no-first-transaction");
    expect(ids({ milestones: { onboardingComplete: "2026-09-02T00:00:00Z" }, totalTransactions: 3 })).not.toContain("no-first-transaction");
    expect(ids({ marketingEmails: false })).toContain("no-marketing");
    expect(ids({ marketingEmails: null })).not.toContain("no-marketing");
  });
});
