import { describe, expect, it } from "vitest";
import { assessHealth, type HealthReport } from "./healthRules";

const NOW = new Date("2026-10-10T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const healthy: HealthReport = {
  generatedAt: NOW.toISOString(),
  services: [
    { key: "database", label: "Database", status: "ok", latencyMs: 40, detail: "" },
    { key: "paystack", label: "Paystack", status: "ok", latencyMs: 300, detail: "" },
  ],
  signals: {
    generatedAt: NOW.toISOString(),
    db: { sizeBytes: 90_000_000, connections: 12, maxConnections: 60 },
    freshness: { fxRatesAt: ago(9), lastEventAt: ago(20), lastSignupAt: ago(30), lastStoreEventAt: ago(40), lastPaystackUpdateAt: ago(5000) },
    cron: { failed24h: [] },
    http: { since: ago(6), total: 200, failures: [] },
  },
};
const ids = (patch: (r: HealthReport) => HealthReport) => assessHealth(patch(structuredClone(healthy)), NOW).map((f) => f.id);

describe("assessHealth", () => {
  it("is healthy when everything answers and runs on time", () => {
    expect(assessHealth(healthy, NOW).map((f) => f.id)).toEqual(["healthy"]);
  });

  it("reports a failing service with its detail", () => {
    const r = structuredClone(healthy);
    r.services[1] = { key: "paystack", label: "Paystack", status: "problem", latencyMs: 90, detail: "Paystack rejected the key." };
    const f = assessHealth(r, NOW);
    expect(f[0]).toMatchObject({ id: "service-paystack", severity: "problem", detail: "Paystack rejected the key." });
  });

  it("does not treat an unknown service result as a problem", () => {
    const r = structuredClone(healthy);
    r.services[1].status = "unknown";
    expect(assessHealth(r, NOW).map((f) => f.id)).toEqual(["healthy"]);
  });

  it("warns when database connections run short", () => {
    expect(ids((r) => ({ ...r, signals: { ...r.signals, db: { ...r.signals.db, connections: 50 } } }))).toContain("db-connections");
    expect(ids((r) => ({ ...r, signals: { ...r.signals, db: { ...r.signals.db, connections: 47 } } }))).not.toContain("db-connections");
  });

  it("judges exchange rates by age: fine, late, very late, missing", () => {
    const withFx = (fxRatesAt: string | null) => (r: HealthReport) => ({ ...r, signals: { ...r.signals, freshness: { ...r.signals.freshness, fxRatesAt } } });
    expect(ids(withFx(ago(35)))).not.toContain("fx-stale");
    expect(assessHealth(withFx(ago(40))(healthy), NOW)[0]).toMatchObject({ id: "fx-stale", severity: "warning" });
    expect(assessHealth(withFx(ago(24 * 8))(healthy), NOW)[0]).toMatchObject({ id: "fx-stale", severity: "problem" });
    expect(ids(withFx(null))).toContain("fx-stale");
  });

  it("names each failed scheduled job", () => {
    const f = assessHealth({ ...healthy, signals: { ...healthy.signals, cron: { failed24h: [{ job: "fx-refresh-daily", failures: 2, last: ago(3), message: "boom" }] } } }, NOW);
    expect(f[0]).toMatchObject({ id: "cron-fx-refresh-daily", severity: "warning" });
    expect(f[0].title).toContain("2 times");
  });

  it("surfaces error answers to scheduled calls, even when the jobs show succeeded", () => {
    const f = assessHealth({ ...healthy, signals: { ...healthy.signals, http: { since: ago(6), total: 211, failures: [{ status: "502", count: 3, sample: "agent C3 failed" }, { status: "401", count: 1, sample: "" }] } } }, NOW);
    expect(f[0].id).toBe("http-failures");
    expect(f[0].title).toBe("4 calls from scheduled jobs got an error back");
    expect(f[0].detail).toContain("502");
  });

  it("only mentions quiet app events as information", () => {
    const f = assessHealth({ ...healthy, signals: { ...healthy.signals, freshness: { ...healthy.signals.freshness, lastEventAt: ago(24 * 5) } } }, NOW);
    expect(f.map((x) => [x.id, x.severity])).toEqual([["events-quiet", "info"], ["healthy", "ok"]]);
  });

  it("puts problems first", () => {
    const r = structuredClone(healthy);
    r.signals.cron.failed24h = [{ job: "j", failures: 1, last: ago(1), message: "" }];
    r.services[0] = { key: "database", label: "Database", status: "problem", latencyMs: null, detail: "down" };
    expect(assessHealth(r, NOW).map((f) => f.severity)).toEqual(["problem", "warning"]);
  });
});
