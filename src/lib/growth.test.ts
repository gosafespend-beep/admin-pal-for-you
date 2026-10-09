import { describe, expect, it } from "vitest";
import { funnelSteps, headline, pct, retentionRate, MIN_SAMPLE } from "./growth";

const funnel = { signedUp: 56, setUp: 46, tracked: 44, onboarded: 37, activated: 2, sawPaywall: 41, checkout: 11, paid: 1 };

describe("pct", () => {
  it("rounds to one decimal and refuses to divide by zero", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(0, 0)).toBeNull();
  });
});

describe("funnelSteps", () => {
  it("expresses every step as a share of sign-ups and labels its source", () => {
    const steps = funnelSteps(funnel);
    expect(steps[0]).toMatchObject({ key: "signedUp", count: 56, ofSignups: 100, source: "database" });
    expect(steps.find((s) => s.key === "activated")).toMatchObject({ count: 2, ofSignups: 3.6, source: "database" });
    expect(steps.find((s) => s.key === "sawPaywall")?.source).toBe("app events");
  });
});

describe("headline", () => {
  it("calls out very low activation", () => {
    expect(headline(funnel)).toMatch(/Only 2 of 56 sign-ups \(3\.6%\)/);
  });

  it("stays quiet when activation is healthy", () => {
    expect(headline({ ...funnel, activated: 30 })).toBeNull();
  });

  it("stays quiet when there are too few sign-ups to judge", () => {
    expect(headline({ ...funnel, signedUp: MIN_SAMPLE - 1, activated: 0 })).toBeNull();
  });
});

describe("retentionRate", () => {
  it("flags small samples", () => {
    expect(retentionRate({ eligible: 5, retained: 2 })).toEqual({ rate: 40, enough: false });
    expect(retentionRate({ eligible: 53, retained: 4 })).toEqual({ rate: 7.5, enough: true });
  });
});
