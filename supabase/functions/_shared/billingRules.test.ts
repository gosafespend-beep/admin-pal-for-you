import { describe, expect, it } from "vitest";
import { effectiveStatus, paystackRequest } from "./billingRules";

const NOW = new Date("2026-10-09T12:00:00Z").getTime();

describe("effectiveStatus", () => {
  it("treats a trial whose end date has passed as expired", () => {
    expect(effectiveStatus("trialing", "2026-10-01T00:00:00Z", NOW)).toBe("expired");
    expect(effectiveStatus("trialing", "2026-10-09T12:00:00Z", NOW)).toBe("expired");
  });

  it("keeps a trial that has not ended", () => {
    expect(effectiveStatus("trialing", "2026-10-15T00:00:00Z", NOW)).toBe("trialing");
  });

  it("never rewrites other statuses", () => {
    for (const s of ["active", "cancelled", "expired", "past_due"]) {
      expect(effectiveStatus(s, "2020-01-01T00:00:00Z", NOW)).toBe(s);
    }
  });

  it("leaves a trial with no end date alone", () => {
    expect(effectiveStatus("trialing", null, NOW)).toBe("trialing");
  });
});

describe("paystackRequest", () => {
  it("maps cancel to disable and reactivate to enable", () => {
    expect(paystackRequest("cancel", "SUB_x", "tok")).toEqual({
      ok: true,
      request: { path: "disable", body: { code: "SUB_x", token: "tok" } },
    });
    expect(paystackRequest("reactivate", "SUB_x", "tok")).toMatchObject({ ok: true, request: { path: "enable" } });
  });

  it("refuses when the code or token is missing", () => {
    expect(paystackRequest("cancel", null, "tok").ok).toBe(false);
    expect(paystackRequest("cancel", "SUB_x", "").ok).toBe(false);
  });
});
