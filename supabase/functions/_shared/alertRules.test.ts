import { describe, expect, it } from "vitest";
import { assessOpsSignals, composeEmail, reconcile, type Detected, type StoredAlert } from "./alertRules";

const NOW = new Date("2026-10-10T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const found = (over: Partial<Detected> = {}): Detected => ({
  fingerprint: "marketing:ai-credits", source: "marketing", severity: "problem", title: "Credits out", detail: "d", ...over,
});
const stored = (over: Partial<StoredAlert> = {}): StoredAlert => ({
  ...found(), first_seen_at: ago(1), last_seen_at: ago(0.5), seen_count: 1, last_notified_at: null, notify_count: 0,
  acknowledged_until: null, resolved_at: null, ...over,
});

describe("reconcile", () => {
  it("records a first sighting but does not email yet", () => {
    const r = reconcile([found()], [], NOW);
    expect(r.upserts).toHaveLength(1);
    expect(r.upserts[0]).toMatchObject({ seen_count: 1, last_notified_at: null, resolved_at: null });
    expect(r.notify).toEqual([]);
  });

  it("emails once the problem is seen on a second run", () => {
    const r = reconcile([found()], [stored()], NOW);
    expect(r.notify).toEqual([{ ...found(), reason: "new" }]);
    expect(r.upserts[0].seen_count).toBe(2);
    expect(r.upserts[0].first_seen_at).toBe(ago(1));
  });

  it("stays quiet between reminders, then reminds", () => {
    const sent = (h: number) => stored({ seen_count: 5, last_notified_at: ago(h), notify_count: 1 });
    expect(reconcile([found()], [sent(23)], NOW).notify).toEqual([]);
    expect(reconcile([found()], [sent(25)], NOW).notify).toEqual([{ ...found(), reason: "reminder" }]);
  });

  it("reminds about warnings less often than problems", () => {
    const w = found({ severity: "warning" });
    const sent = (h: number) => stored({ ...w, seen_count: 9, last_notified_at: ago(h), notify_count: 1 });
    expect(reconcile([w], [sent(30)], NOW).notify).toEqual([]);
    expect(reconcile([w], [sent(73)], NOW).notify).toHaveLength(1);
  });

  it("keeps an acknowledged problem quiet until the acknowledgement ends", () => {
    const ack = (until: string) => stored({ seen_count: 5, last_notified_at: ago(48), notify_count: 1, acknowledged_until: until });
    expect(reconcile([found()], [ack(new Date(NOW.getTime() + 86_400_000).toISOString())], NOW).notify).toEqual([]);
    expect(reconcile([found()], [ack(ago(1))], NOW).notify).toHaveLength(1);
  });

  it("an acknowledged warning that becomes a problem is emailed and un-acknowledged", () => {
    const prev = stored({ severity: "warning", seen_count: 5, last_notified_at: ago(2), notify_count: 1, acknowledged_until: new Date(NOW.getTime() + 86_400_000).toISOString() });
    const r = reconcile([found()], [prev], NOW);
    expect(r.notify).toEqual([{ ...found(), reason: "worse" }]);
    expect(r.upserts[0].acknowledged_until).toBeNull();
  });

  it("resolves what is no longer found and reports the ones people were told about", () => {
    const told = stored({ fingerprint: "a", title: "A", last_notified_at: ago(3), notify_count: 1 });
    const untold = stored({ fingerprint: "b", title: "B" });
    const r = reconcile([], [told, untold], NOW);
    expect(r.resolve.sort()).toEqual(["a", "b"]);
    expect(r.resolvedNow.map((x) => x.title)).toEqual(["A"]);
  });

  it("treats a problem that comes back after being resolved as new", () => {
    const old = stored({ resolved_at: ago(10), seen_count: 40, last_notified_at: ago(20), notify_count: 3 });
    const r = reconcile([found()], [old], NOW);
    expect(r.upserts[0]).toMatchObject({ seen_count: 1, notify_count: 0, last_notified_at: null, resolved_at: null, first_seen_at: NOW.toISOString() });
    expect(r.notify).toEqual([]);
  });

  it("ignores duplicate findings and leaves already-resolved alerts alone", () => {
    const r = reconcile([found(), found()], [stored({ fingerprint: "old", resolved_at: ago(5) })], NOW);
    expect(r.upserts).toHaveLength(1);
    expect(r.resolve).toEqual([]);
  });
});

describe("assessOpsSignals", () => {
  const base = { admins: [], dataRequests: { overdue: 0, dueSoon: 0, oldestOverdue: null } };

  it("is quiet when nothing is wrong", () => {
    expect(assessOpsSignals({ ...base, admins: [{ userId: "u1", email: "me@x.co", grantedAt: "2026-08-01T00:00:00Z" }] }, NOW)).toEqual([]);
  });

  it("flags an admin added in the last day, by name", () => {
    const [a] = assessOpsSignals({ ...base, admins: [{ userId: "u2", email: "new@x.co", grantedAt: ago(3) }] }, NOW);
    expect(a).toMatchObject({ fingerprint: "security:new-admin:u2", severity: "problem" });
    expect(a.detail).toContain("new@x.co");
  });

  it("warns when lifecycle emails keep failing, but not for a one-off", () => {
    const withLifecycle = (failed24h: number) => assessOpsSignals({ ...base, lifecycle: { mode: "live", failed24h } }, NOW);
    expect(withLifecycle(2)).toEqual([]);
    const [a] = withLifecycle(3);
    expect(a).toMatchObject({ fingerprint: "lifecycle:failing", severity: "warning", title: "3 lifecycle emails failed in the last day" });
    expect(assessOpsSignals(base, NOW)).toEqual([]);
  });

  it("flags overdue and soon-due data requests", () => {
    const out = assessOpsSignals({ ...base, dataRequests: { overdue: 2, dueSoon: 1, oldestOverdue: ago(30) } }, NOW);
    expect(out.map((o) => [o.fingerprint, o.severity])).toEqual([["privacy:requests-overdue", "problem"], ["privacy:requests-due-soon", "warning"]]);
    expect(out[0].title).toBe("2 data requests past the deadline");
  });
});

describe("composeEmail", () => {
  const n = [{ ...found(), reason: "new" as const }, { ...found({ fingerprint: "x", severity: "warning", title: "Slow <b>" }), reason: "reminder" as const }];

  it("leads with the worst problem and counts the rest", () => {
    expect(composeEmail(n, [], "https://admin.example").subject).toBe("[Safe Spend] Problem: Credits out (+1 more)");
  });

  it("escapes anything that came from outside", () => {
    const { html, text } = composeEmail(n, [], "https://admin.example");
    expect(html).toContain("Slow &lt;b&gt;");
    expect(html).not.toContain("Slow <b>");
    expect(text).toContain("https://admin.example/alerts");
  });

  it("can be a fixed-only message", () => {
    const m = composeEmail([], [{ title: "Credits out" }], "https://admin.example");
    expect(m.subject).toBe("[Safe Spend] Fixed: Credits out");
    expect(m.html).toContain("Fixed since the last email");
  });
});
