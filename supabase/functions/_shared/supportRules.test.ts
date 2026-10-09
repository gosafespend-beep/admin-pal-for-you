import { describe, expect, it } from "vitest";
import { classifyQuery, renderMacro, validateMacro, variablesIn } from "./supportRules";

const good = { title: "Trial ended", category: "billing", subject: "About your trial", body: "Hi {{first_name}}, your trial ended on {{trial_end}}." };

describe("classifyQuery", () => {
  it("recognises account ids, Paystack codes and text", () => {
    expect(classifyQuery("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toEqual({ kind: "uuid", q: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" });
    expect(classifyQuery(" CUS_abc123xyz ").kind).toBe("paystack_code");
    expect(classifyQuery("SUB_abc123xyz").kind).toBe("paystack_code");
    expect(classifyQuery("sam@example.com")).toEqual({ kind: "text", q: "sam@example.com" });
  });

  it("refuses queries too short to be useful", () => {
    for (const q of ["", "  ", "ab", undefined, 42]) expect(classifyQuery(q).kind).toBe("too_short");
  });

  it("caps the length", () => {
    expect(classifyQuery("a".repeat(500)).q).toHaveLength(100);
  });
});

describe("validateMacro", () => {
  it("accepts a good reply and trims it", () => {
    const r = validateMacro({ ...good, title: "  Trial ended  " });
    expect(r.ok && r.value.title).toBe("Trial ended");
  });

  it("rejects missing or out-of-range fields", () => {
    for (const bad of [
      { ...good, title: "no" },
      { ...good, category: "sales" },
      { ...good, subject: "x" },
      { ...good, subject: "two\nlines" },
      { ...good, body: "short" },
      { ...good, body: "x".repeat(4001) },
    ]) {
      expect(validateMacro(bad).ok).toBe(false);
    }
  });

  it("rejects placeholders that do not exist, in the subject or the body", () => {
    const r = validateMacro({ ...good, body: "Hi {{firstname}}, welcome." });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("{{firstname}}");
    expect(validateMacro({ ...good, subject: "About {{plan}}" }).ok).toBe(false);
  });

  it("allows an edit that only changes one field", () => {
    expect(validateMacro({ active: false }, true).ok).toBe(true);
    expect(validateMacro({ title: "x" }, true).ok).toBe(false);
    expect(validateMacro({ active: "no" }, true).ok).toBe(false);
  });
});

describe("renderMacro", () => {
  it("fills in values, ignoring spacing and case in the placeholder", () => {
    const r = renderMacro({ subject: "Hi {{ First_Name }}", body: "Trial ended {{trial_end}}." }, { first_name: "Sam", trial_end: "Oct 1, 2026" });
    expect(r).toEqual({ subject: "Hi Sam", body: "Trial ended Oct 1, 2026.", missing: [] });
  });

  it("leaves missing values visible and reports them once", () => {
    const r = renderMacro({ subject: "s", body: "{{trial_end}} and again {{trial_end}}, {{email}}" }, { email: "a@b.co", trial_end: null });
    expect(r.body).toBe("[[trial_end]] and again [[trial_end]], a@b.co");
    expect(r.missing).toEqual(["trial_end"]);
  });

  it("treats blank values as missing", () => {
    expect(renderMacro({ subject: "s", body: "{{email}}" }, { email: "  " }).missing).toEqual(["email"]);
  });
});

describe("variablesIn", () => {
  it("lists each placeholder once", () => {
    expect(variablesIn("{{email}} {{email}} {{ trial_end }}").sort()).toEqual(["email", "trial_end"]);
  });
});
