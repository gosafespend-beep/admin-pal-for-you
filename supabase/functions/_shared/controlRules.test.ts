import { describe, expect, it } from "vitest";
import {
  bannerIsLive, buildPublicConfig, compareVersions, evaluateFlag, flagBucket, parseClientInfo, parseVersion,
  validateBanner, validateFlag, validateVersions, type Control, type Flag,
} from "./controlRules";

const NOW = new Date("2026-10-10T12:00:00Z");
const control = (over: Partial<Control> = {}): Control => ({
  banner_active: false, banner_kind: "banner", banner_severity: "info", banner_message: "",
  banner_starts_at: null, banner_ends_at: null,
  ios_latest: "1.4.0", ios_min: "1.2.0", ios_store_url: "https://apps.apple.com/app/x",
  android_latest: "1.4.1", android_min: null, android_store_url: "https://play.google.com/store/apps/details?id=x",
  ...over,
});
const flag = (over: Partial<Flag> = {}): Flag => ({
  key: "new_budget_screen", description: "New budget screen", enabled: true, rollout_pct: 100, platforms: ["ios", "android", "web"], public: true, ...over,
});

describe("versions", () => {
  it("parses and compares", () => {
    expect(parseVersion("1.4.2")).toEqual([1, 4, 2]);
    expect(parseVersion("1.4")).toEqual([1, 4, 0]);
    expect(parseVersion("1.4", true)).toBeNull();
    for (const bad of ["", "v1.4.2", "1.4.2.1", "1.x.2", "1000.0.0", null, 5, "1.4.2-beta"]) expect(parseVersion(bad)).toBeNull();
    expect(compareVersions("1.4.2", "1.4.10")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.4", "1.4.0")).toBe(0);
    expect(compareVersions("nope", "1.0.0")).toBeNull();
  });
});

describe("validateVersions", () => {
  it("accepts a store version pair and link", () => {
    expect(validateVersions({ platform: "ios", latest: "1.4.0", min: "1.2.0", storeUrl: "https://apps.apple.com/app/x" }))
      .toEqual({ ok: true, value: { platform: "ios", latest: "1.4.0", min: "1.2.0", storeUrl: "https://apps.apple.com/app/x" } });
  });
  it("refuses to force an update to a version that is not in the store", () => {
    const r = validateVersions({ platform: "android", latest: "1.4.0", min: "1.5.0" });
    expect(!r.ok && r.error).toMatch(/can't be newer/);
    expect(validateVersions({ platform: "android", min: "1.0.0" }).ok).toBe(false);
  });
  it("allows clearing both, and rejects bad input", () => {
    expect(validateVersions({ platform: "ios", latest: "", min: "" })).toEqual({ ok: true, value: { platform: "ios", latest: null, min: null, storeUrl: null } });
    for (const bad of [{ platform: "web" }, { platform: "ios", latest: "1.4" }, { platform: "ios", latest: "1.4.0", storeUrl: "http://insecure" }, { platform: "ios", latest: "1.4.0", storeUrl: "javascript:alert(1)" }]) {
      expect(validateVersions(bad).ok).toBe(false);
    }
  });
});

describe("validateBanner", () => {
  it("needs a message to be on, and a sensible window", () => {
    expect(validateBanner({ active: true, message: "" }).ok).toBe(false);
    expect(validateBanner({ active: false, message: "" }).ok).toBe(true);
    expect(validateBanner({ active: true, message: "We are down for maintenance until 3pm", endsAt: "2026-10-10T15:00:00Z" }).ok).toBe(true);
    expect(validateBanner({ active: true, message: "Back soon, sorry", startsAt: "2026-10-11T00:00:00Z", endsAt: "2026-10-10T00:00:00Z" }).ok).toBe(false);
    expect(validateBanner({ active: true, message: "x".repeat(281) }).ok).toBe(false);
    expect(validateBanner({ active: true, message: "Back soon, sorry", startsAt: "not a date" }).ok).toBe(false);
    expect(validateBanner({ active: "yes" }).ok).toBe(false);
    expect(validateBanner({ active: true, message: "Back soon, sorry", kind: "popup" }).ok).toBe(false);
  });
  it("knows when it is live", () => {
    const live = (over: Partial<Control>) => bannerIsLive({ ...control(), banner_active: true, ...over }, NOW);
    expect(live({})).toBe(true);
    expect(live({ banner_starts_at: "2026-10-10T13:00:00Z" })).toBe(false);
    expect(live({ banner_ends_at: "2026-10-10T11:00:00Z" })).toBe(false);
    expect(bannerIsLive(control(), NOW)).toBe(false);
  });
});

describe("flags", () => {
  it("validates names, rollout and platforms", () => {
    expect(validateFlag({ key: "new_budget_screen", description: "New screen", enabled: false }).ok).toBe(true);
    for (const bad of [
      { key: "Bad Name", description: "x y z", enabled: true }, { key: "ab", description: "x y z", enabled: true },
      { key: "good_key", description: "no", enabled: true }, { key: "good_key", description: "fine desc", enabled: "yes" },
      { key: "good_key", description: "fine desc", enabled: true, rolloutPct: 101 }, { key: "good_key", description: "fine desc", enabled: true, platforms: [] },
      { key: "good_key", description: "fine desc", enabled: true, platforms: ["windows"] },
    ]) expect(validateFlag(bad).ok).toBe(false);
  });

  it("places the same person in the same group every time", () => {
    expect(flagBucket("a_flag", "user-1")).toBe(flagBucket("a_flag", "user-1"));
    expect(flagBucket("a_flag", "user-1")).toBeGreaterThanOrEqual(0);
    expect(flagBucket("a_flag", "user-1")).toBeLessThan(100);
    const ids = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
    const share = ids.filter((id) => evaluateFlag(flag({ rollout_pct: 25 }), "ios", id)).length / ids.length;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });

  it("respects on/off, platform and partial rollouts without an identity", () => {
    expect(evaluateFlag(flag({ enabled: false }), "ios", "u")).toBe(false);
    expect(evaluateFlag(flag({ platforms: ["android"] }), "ios", "u")).toBe(false);
    expect(evaluateFlag(flag(), "web", null)).toBe(true);
    expect(evaluateFlag(flag({ rollout_pct: 0 }), "ios", "u")).toBe(false);
    expect(evaluateFlag(flag({ rollout_pct: 50 }), "ios", null)).toBe(false);
  });
});

describe("buildPublicConfig", () => {
  it("tells an app behind the minimum that an update is required", () => {
    const c = buildPublicConfig(control(), [], { platform: "ios", version: "1.1.0" }, NOW);
    expect(c.update).toMatchObject({ required: true, available: true, min: "1.2.0", latest: "1.4.0" });
  });
  it("only suggests an update when behind the newest but at or above the minimum", () => {
    expect(buildPublicConfig(control(), [], { platform: "ios", version: "1.3.0" }, NOW).update).toMatchObject({ required: false, available: true });
    expect(buildPublicConfig(control(), [], { platform: "ios", version: "1.4.0" }, NOW).update).toMatchObject({ required: false, available: false });
  });
  it("never forces an app that did not say its version, or a platform with no minimum", () => {
    expect(buildPublicConfig(control(), [], { platform: "ios" }, NOW).update).toMatchObject({ required: false, available: false });
    expect(buildPublicConfig(control(), [], { platform: "android", version: "0.0.1" }, NOW).update).toMatchObject({ required: false, available: true });
  });
  it("has no update section for the web", () => {
    expect(buildPublicConfig(control(), [], { platform: "web" }, NOW).update).toBeNull();
  });
  it("shows a live banner and hides an expired or off one", () => {
    const on = control({ banner_active: true, banner_message: "Down for maintenance until 3pm", banner_kind: "maintenance", banner_severity: "critical" });
    expect(buildPublicConfig(on, [], { platform: "web" }, NOW).banner).toEqual({ kind: "maintenance", severity: "critical", message: "Down for maintenance until 3pm" });
    expect(buildPublicConfig({ ...on, banner_ends_at: "2026-10-10T11:00:00Z" }, [], { platform: "web" }, NOW).banner).toBeNull();
    expect(buildPublicConfig(control(), [], { platform: "web" }, NOW).banner).toBeNull();
  });
  it("returns only public flags, evaluated for this client", () => {
    const flags = [flag(), flag({ key: "internal_only", public: false }), flag({ key: "ios_only", platforms: ["ios"] })];
    expect(buildPublicConfig(control(), flags, { platform: "android", id: "u1" }, NOW).flags).toEqual({ new_budget_screen: true, ios_only: false });
  });
});

describe("parseClientInfo", () => {
  it("reads a valid request and drops anything odd instead of trusting it", () => {
    expect(parseClientInfo(new URLSearchParams("platform=ios&v=1.4.0&id=abc-123"))).toEqual({ platform: "ios", version: "1.4.0", id: "abc-123" });
    expect(parseClientInfo(new URLSearchParams("platform=ios&v=banana&id=%3Cscript%3E"))).toEqual({ platform: "ios", version: null, id: null });
    expect(parseClientInfo(new URLSearchParams("platform=playstation"))).toBeNull();
    expect(parseClientInfo(new URLSearchParams(""))).toBeNull();
  });
});
