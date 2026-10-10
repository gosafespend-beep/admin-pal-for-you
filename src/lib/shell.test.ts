import { describe, expect, it } from "vitest";
import { documentTitle, endedTrials, pageName, signupsLine, summarizeAlerts } from "./shell";

const NOW = new Date("2026-10-10T12:00:00Z");

describe("pageName / documentTitle", () => {
  it("names every route, including nested ones", () => {
    expect(pageName("/dashboard")).toBe("Dashboard");
    expect(pageName("/users")).toBe("Users");
    expect(pageName("/users/86d6c8a8-183c-484b-8109-59d8b9c7e554")).toBe("User");
    expect(pageName("/blog")).toBe("Blog");
    expect(pageName("/blog/new")).toBe("Blog editor");
    expect(pageName("/blog/editor/abc")).toBe("Blog editor");
    expect(pageName("/app-controls")).toBe("App controls");
    expect(pageName("/nope")).toBe("Page");
  });
  it("builds a tab title", () => {
    expect(documentTitle("/alerts")).toBe("Alerts · Safe Spend Admin");
  });
});

describe("summarizeAlerts", () => {
  const a = (severity: "problem" | "warning", acknowledged_until: string | null = null) => ({ severity, acknowledged_until });

  it("is quiet with nothing open", () => {
    expect(summarizeAlerts([], NOW)).toEqual({ needsAttention: 0, problems: 0, warnings: 0, paused: 0, tone: "none" });
  });
  it("is red when anything is a problem, amber when only warnings", () => {
    expect(summarizeAlerts([a("warning"), a("problem")], NOW)).toMatchObject({ needsAttention: 2, problems: 1, warnings: 1, tone: "problem" });
    expect(summarizeAlerts([a("warning")], NOW).tone).toBe("warning");
  });
  it("does not count an alert someone paused on purpose, but still reports it", () => {
    const future = "2026-10-20T00:00:00Z";
    const s = summarizeAlerts([a("problem", future), a("warning")], NOW);
    expect(s).toMatchObject({ needsAttention: 1, problems: 0, paused: 1, tone: "warning" });
  });
  it("counts an alert again once its pause has ended", () => {
    expect(summarizeAlerts([a("problem", "2026-10-01T00:00:00Z")], NOW)).toMatchObject({ needsAttention: 1, paused: 0, tone: "problem" });
  });
});

describe("signupsLine / endedTrials", () => {
  it("states both months plainly", () => {
    expect(signupsLine(5, 12)).toBe("5 signups so far this month, 12 last month");
    expect(signupsLine(1, 0)).toBe("1 signup so far this month, 0 last month");
  });
  it("accounts for subscriptions that are not active, trialing or cancelled", () => {
    expect(endedTrials({ total: 12, active: 1, trialing: 0, cancelled: 0 })).toBe(11);
    expect(endedTrials({ total: 2, active: 3, trialing: 0, cancelled: 0 })).toBe(0);
  });
});
