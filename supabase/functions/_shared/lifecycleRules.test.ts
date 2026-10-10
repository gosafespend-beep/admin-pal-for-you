import { describe, expect, it } from "vitest";
import {
  formatEmailDate, maskEmail, remainingToday, renderEmail, unsubscribePageUrl,
  validateSettingsEdit, validateTemplateEdit, type TemplateKey,
} from "./lifecycleRules";

const tpl = (key: TemplateKey, over: Partial<{ subject: string; body: string; audience: "service" | "marketing" }> = {}) => ({
  key, subject: "Hello {{first_name}}", body: "Hi {{first_name}},\n\nOpen {{app_url}} today.\n\nThe team", audience: "service" as const, ...over,
});
const values = { first_name: "Sam", app_url: "https://app.example.com" };

describe("validateTemplateEdit", () => {
  it("accepts a valid edit and trims it", () => {
    const r = validateTemplateEdit("welcome", { subject: "  Welcome aboard  ", body: "Hi {{first_name}}, welcome to the app. See {{app_url}}." });
    expect(r.ok && r.value.subject).toBe("Welcome aboard");
  });

  it("rejects placeholders a template cannot fill", () => {
    const r = validateTemplateEdit("welcome", { body: "Your trial ends {{trial_end}} so come back soon, ok?" });
    expect(!r.ok && r.error).toContain("{{trial_end}}");
    expect(validateTemplateEdit("trial_ending", { body: "Your trial ends {{trial_end}} so come back soon, ok?" }).ok).toBe(true);
    expect(validateTemplateEdit("welcome", { body: "Hello {{nme}}, welcome to the app and thanks." }).ok).toBe(false);
  });

  it("enforces lengths and a single-line subject", () => {
    expect(validateTemplateEdit("welcome", { subject: "no" }).ok).toBe(false);
    expect(validateTemplateEdit("welcome", { subject: "two\nlines" }).ok).toBe(false);
    expect(validateTemplateEdit("welcome", { body: "too short" }).ok).toBe(false);
    expect(validateTemplateEdit("welcome", { body: "x".repeat(3001) }).ok).toBe(false);
  });

  it("only lets the nudge choose its audience", () => {
    expect(validateTemplateEdit("activation_nudge", { audience: "service" }).ok).toBe(true);
    expect(validateTemplateEdit("welcome", { audience: "marketing" }).ok).toBe(false);
    expect(validateTemplateEdit("trial_ending", { audience: "marketing" }).ok).toBe(false);
    expect(validateTemplateEdit("activation_nudge", { audience: "everyone" }).ok).toBe(false);
  });
});

describe("validateSettingsEdit", () => {
  it("accepts a mode and limits within range", () => {
    expect(validateSettingsEdit({ mode: "dry_run", daily_cap: 40, min_gap_hours: 48 })).toEqual({ ok: true, value: { mode: "dry_run", daily_cap: 40, min_gap_hours: 48 } });
  });
  it("rejects bad values and empty edits", () => {
    for (const bad of [{ mode: "blast" }, { daily_cap: 0 }, { daily_cap: 501 }, { daily_cap: 1.5 }, { min_gap_hours: 0 }, { min_gap_hours: 721 }, {}]) {
      expect(validateSettingsEdit(bad).ok).toBe(false);
    }
  });
});

describe("renderEmail", () => {
  it("fills placeholders, uses 'there' without a name, and builds text and html", () => {
    const r = renderEmail(tpl("welcome"), { ...values, first_name: null });
    expect(r.ok && r.subject).toBe("Hello there");
    expect(r.ok && r.text).toContain("Open https://app.example.com today.");
    expect(r.ok && r.html).toContain('<a href="https://app.example.com"');
    expect(r.ok && r.html).toContain("you have a Safe Spend account");
  });

  it("escapes anything that came from a person", () => {
    const r = renderEmail(tpl("welcome"), { ...values, first_name: '<script>alert("x")</script>' });
    expect(r.ok && r.html).not.toContain("<script>");
    expect(r.ok && r.html).toContain("&lt;script&gt;");
  });

  it("refuses to send with a value missing", () => {
    const r = renderEmail(tpl("trial_ending", { body: "Your trial ends on {{trial_end}}. Open {{app_url}} to carry on." }), values);
    expect(r).toEqual({ ok: false, error: "No value for {{trial_end}}" });
    expect(renderEmail(tpl("trial_ending", { body: "Your trial ends on {{trial_end}}. Open {{app_url}} to carry on." }), { ...values, trial_end: "Oct 12, 2026" }).ok).toBe(true);
  });

  it("will not render a marketing email without an unsubscribe link, and includes it when given", () => {
    const m = tpl("activation_nudge", { audience: "marketing" });
    expect(renderEmail(m, values)).toEqual({ ok: false, error: "A marketing email must have an unsubscribe link" });
    const ok = renderEmail(m, values, { unsubscribeUrl: unsubscribePageUrl("abc-123") });
    expect(ok.ok && ok.html).toContain("https://admin.gosafespend.com/unsubscribe?t=abc-123");
    expect(ok.ok && ok.text).toContain("Unsubscribe: https://admin.gosafespend.com/unsubscribe?t=abc-123");
  });

  it("ignores a placeholder the template is not allowed to use rather than leaking it", () => {
    const r = renderEmail(tpl("welcome", { body: "Hi {{first_name}}, your trial ends {{trial_end}}. Open {{app_url}} soon." }), { ...values, trial_end: "Oct 12, 2026" });
    expect(r).toEqual({ ok: false, error: "No value for {{trial_end}}" });
  });
});

describe("helpers", () => {
  it("counts what is left of the daily limit, never below zero", () => {
    expect(remainingToday(25, 10)).toBe(15);
    expect(remainingToday(25, 40)).toBe(0);
  });
  it("masks addresses", () => {
    expect(maskEmail("alex@example.com")).toBe("a***@example.com");
    expect(maskEmail(null)).toBe("unknown");
    expect(maskEmail("nonsense")).toBe("unknown");
  });
  it("formats dates in UTC", () => {
    expect(formatEmailDate("2026-10-12T23:30:00Z")).toBe("Oct 12, 2026");
  });
  it("encodes the token in the unsubscribe link", () => {
    expect(unsubscribePageUrl("a b")).toBe("https://admin.gosafespend.com/unsubscribe?t=a%20b");
  });
});
