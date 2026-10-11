import { describe, expect, it } from "vitest";
import { explainRefusal, validateControl } from "./marketingControlRules";

describe("validateControl", () => {
  it("accepts a pause of one agent or channel and trims the reason", () => {
    expect(validateControl({ action: "pause", scope: "agent", target: "S4R", reason: "  Credits are out, stop retrying  " }))
      .toEqual({ ok: true, value: { action: "pause", scope: "agent", target: "S4R", reason: "Credits are out, stop retrying" } });
    expect(validateControl({ action: "resume", scope: "channel", target: "threads", reason: "fixed" }).ok).toBe(true);
  });

  it("pausing everything takes no target", () => {
    expect(validateControl({ action: "pause", scope: "all", reason: "Emergency stop while we check" }).ok).toBe(true);
    expect(validateControl({ action: "pause", scope: "all", target: "S4R", reason: "Emergency stop while we check" }).ok).toBe(false);
  });

  it("demands a real reason to pause, a shorter one to resume", () => {
    expect(validateControl({ action: "pause", scope: "all", reason: "stop" }).ok).toBe(false);
    expect(validateControl({ action: "resume", scope: "all", reason: "stop" }).ok).toBe(false);
    expect(validateControl({ action: "resume", scope: "all", reason: "fixed" }).ok).toBe(true);
    expect(validateControl({ action: "pause", scope: "all", reason: "x".repeat(301) }).ok).toBe(false);
  });

  it("rejects bad shapes and targets that could be anything", () => {
    for (const bad of [
      null, "pause", {}, { action: "delete", scope: "all", reason: "long enough reason" },
      { action: "pause", scope: "galaxy", reason: "long enough reason" },
      { action: "pause", scope: "agent", reason: "long enough reason" },
      { action: "pause", scope: "agent", target: "S4R; drop table x", reason: "long enough reason" },
      { action: "pause", scope: "channel", target: "a".repeat(41), reason: "long enough reason" },
    ]) {
      expect(validateControl(bad).ok).toBe(false);
    }
  });
});

describe("explainRefusal", () => {
  it("maps the database's coded refusals to a status and a sentence", () => {
    expect(explainRefusal("already: agent C3 is already paused")).toEqual({ status: 409, error: "Agent C3 is already paused." });
    expect(explainRefusal("not_found: no agent NOPE")).toEqual({ status: 404, error: "No agent NOPE." });
    expect(explainRefusal("deprecated: agent X is retired")?.status).toBe(409);
  });

  it("leaves anything else alone so it is treated as an unexpected error", () => {
    expect(explainRefusal("deadlock detected")).toBeNull();
    expect(explainRefusal("")).toBeNull();
  });
});
