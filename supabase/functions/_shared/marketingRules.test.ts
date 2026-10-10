import { describe, expect, it } from "vitest";
import { assessMarketing, classifyError, type MarketingOverview } from "./marketingRules";

const NOW = new Date("2026-10-09T21:00:00Z");

const healthy: MarketingOverview = {
  generatedAt: NOW.toISOString(),
  publishing: { lastPublishedAt: "2026-10-09T15:00:00Z", byChannel: [] },
  runs: { last24h: { ok: 10, failed: 0 }, last7d: { ok: 70, failed: 1 }, lastSuccessAt: "2026-10-09T20:00:00Z", failing: [] },
  queue: { byStatus: [], scheduledOverdue: 0, reviewsPending: 0 },
  incidents: [],
  spend: { daily: [], agents: [] },
  channels: [{ platform: "facebook", handle: "x", enabled: true, healthOk: true, healthDetail: "ok", checkedAt: "2026-10-09T05:00:00Z", tokenExpiresAt: null, tokenUpdatedAt: null }],
  jobs: [],
  flags: [],
  topPosts: [],
};
const ids = (patch: Partial<MarketingOverview>) => assessMarketing({ ...healthy, ...patch }, NOW).map((f) => f.id);

const creditFailure = {
  agent: "C3", action: "plan_campaign", failures: 100, lastFailureAt: "2026-10-09T15:00:00Z", lastSuccessAt: "2026-09-23T23:00:00Z",
  lastError: 'anthropic 400: {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low',
};

describe("classifyError", () => {
  it("groups errors by what to do about them", () => {
    expect(classifyError(creditFailure.lastError)).toBe("credits");
    expect(classifyError("429 Too Many Requests")).toBe("rate_limit");
    expect(classifyError("401 Unauthorized")).toBe("auth");
    expect(classifyError("Expected ',' or '}' after property value in JSON at position 172")).toBe("parse");
    expect(classifyError("no JSON object in model output")).toBe("parse");
    expect(classifyError("socket hang up")).toBe("other");
    expect(classifyError(null)).toBe("other");
  });
});

describe("assessMarketing", () => {
  it("reports healthy when nothing is wrong", () => {
    const f = assessMarketing(healthy, NOW);
    expect(f.map((x) => x.id)).toEqual(["healthy"]);
  });

  it("recognises the real outage: credits out, nothing posted for weeks", () => {
    const f = assessMarketing({
      ...healthy,
      publishing: { lastPublishedAt: "2026-09-23T18:00:00Z", byChannel: [] },
      runs: { last24h: { ok: 0, failed: 6 }, last7d: { ok: 0, failed: 42 }, lastSuccessAt: "2026-09-23T23:00:00Z", failing: [creditFailure] },
    }, NOW);
    expect(f.map((x) => x.id)).toEqual(["ai-credits", "stalled"]);
    expect(f[0].title).toMatch(/credit balance/);
    expect(f[1].title).toBe("Nothing has been posted for 16 days");
    expect(f[1].detail).toMatch(/credit problem/);
  });

  it("calls out failing runs that are not about credits", () => {
    const other = { ...creditFailure, lastError: "socket hang up" };
    expect(ids({ runs: { ...healthy.runs, last24h: { ok: 0, failed: 5 }, failing: [other] } })).toContain("runs-failing");
    expect(ids({ runs: { ...healthy.runs, last24h: { ok: 3, failed: 5 }, failing: [other] } })).toContain("runs-flaky");
  });

  it("does not call credits an outage while other runs still succeed", () => {
    expect(ids({ runs: { ...healthy.runs, failing: [creditFailure] } })).not.toContain("ai-credits");
  });

  it("warns about repeated unreadable AI replies", () => {
    const parse = { ...creditFailure, failures: 4, lastError: "no JSON object in model output" };
    expect(ids({ runs: { ...healthy.runs, failing: [parse] } })).toContain("parse-failures");
  });

  it("flags an unhealthy or unchecked channel, but not a switched-off one", () => {
    const base = healthy.channels[0];
    expect(ids({ channels: [{ ...base, healthOk: false, healthDetail: "token rejected" }] })).toContain("channel-facebook");
    expect(ids({ channels: [{ ...base, checkedAt: "2026-10-01T00:00:00Z" }] })).toContain("channel-stale-facebook");
    expect(ids({ channels: [{ ...base, enabled: false, healthOk: false }] })).toEqual(["healthy"]);
  });

  it("warns before a login token expires and says when nothing renews it", () => {
    const ig = { ...healthy.channels[0], platform: "instagram", tokenExpiresAt: "2026-10-11T15:18:00Z", tokenUpdatedAt: "2026-08-12T15:24:00Z" };
    const f = assessMarketing({ ...healthy, channels: [ig] }, NOW);
    expect(f[0].id).toBe("token-instagram");
    expect(f[0].severity).toBe("problem");
    expect(f[0].title).toBe("instagram login expires in 1 day");
    expect(f[0].detail).toMatch(/renews this login/);

    const renewed = assessMarketing({ ...healthy, channels: [ig], jobs: [{ name: "ig", schedule: "0 3 * * 1", active: true, target: "ig-token-refresh", lastRunAt: null, lastStatus: null }] }, NOW);
    expect(renewed[0].detail).not.toMatch(/renews this login/);

    const later = { ...ig, tokenExpiresAt: "2026-10-14T00:00:00Z" };
    expect(assessMarketing({ ...healthy, channels: [later] }, NOW)[0].severity).toBe("warning");
    expect(ids({ channels: [{ ...ig, tokenExpiresAt: "2026-12-01T00:00:00Z" }] })).toEqual(["healthy"]);
    expect(assessMarketing({ ...healthy, channels: [{ ...ig, tokenExpiresAt: "2026-10-01T00:00:00Z" }] }, NOW)[0].title).toMatch(/has expired/);
  });

  it("notes posts stuck in the queue", () => {
    const stuck = { status: "approved", count: 7, oldest: "2026-08-12T00:00:00Z", newest: "2026-08-13T00:00:00Z" };
    expect(ids({ queue: { ...healthy.queue, byStatus: [stuck] } })).toContain("queue-approved");
    expect(ids({ queue: { ...healthy.queue, byStatus: [{ ...stuck, oldest: "2026-10-08T00:00:00Z" }] } })).toEqual(["healthy"]);
    expect(ids({ queue: { ...healthy.queue, scheduledOverdue: 2 } })).toContain("overdue");
  });

  it("surfaces open incidents by severity", () => {
    const f = assessMarketing({ ...healthy, incidents: [{ id: "1", agent: null, kind: "bad claim", severity: "high", summary: "x", createdAt: "2026-10-08T00:00:00Z" }] }, NOW);
    expect(f[0].severity).toBe("problem");
  });

  it("warns when an agent reaches its daily cap", () => {
    const agent = { id: "C3", codename: "CAMPAIGN", status: "active", tier: 1, capUsdDay: 1.5, runs30d: 1, failed30d: 0, cost30d: 1.4, costToday: 1.4, lastRunAt: null };
    expect(ids({ spend: { daily: [], agents: [agent] } })).toContain("cap-C3");
    expect(ids({ spend: { daily: [], agents: [{ ...agent, costToday: 0.5 }] } })).toEqual(["healthy"]);
  });

  it("catches the placeholder report sender", () => {
    const flags = [{ key: "report_from", value: "Go Safe Spend Growth <reports@REPLACE_WITH_YOUR_DOMAIN>", updatedAt: "2026-08-06T00:00:00Z" }];
    expect(ids({ flags })).toContain("report-sender");
  });

  it("puts problems before warnings", () => {
    const f = assessMarketing({ ...healthy, queue: { ...healthy.queue, scheduledOverdue: 1 }, publishing: { lastPublishedAt: "2026-09-01T00:00:00Z", byChannel: [] } }, NOW);
    expect(f.map((x) => x.severity)).toEqual(["problem", "warning"]);
  });

  it("shows a deliberate pause as information and stops calling the quiet period a stall", () => {
    const pause = { scope: "agent" as const, target: "S4R", reason: "Credits are out, stop retrying", pausedAt: "2026-10-09T10:00:00Z", batch: null };
    const f = assessMarketing({ ...healthy, publishing: { lastPublishedAt: "2026-09-01T00:00:00Z", byChannel: [] }, pauses: [pause] }, NOW);
    expect(f.map((x) => [x.id, x.severity])).toEqual([["paused", "info"]]);
    expect(f.some((x) => x.id === "stalled")).toBe(false);
    expect(f[0].detail).toContain("Credits are out");
  });

  it("warns when a pause has been left on for two weeks", () => {
    const pause = { scope: "channel" as const, target: "threads", reason: "Account under review", pausedAt: "2026-09-20T00:00:00Z", batch: null };
    const f = assessMarketing({ ...healthy, pauses: [pause] }, NOW);
    expect(f[0]).toMatchObject({ id: "paused", severity: "warning" });
    expect(f[0].title).toBe("Marketing has been paused for 19 days");
  });
});
