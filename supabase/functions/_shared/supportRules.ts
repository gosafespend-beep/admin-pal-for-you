/**
 * Rules for the support tools: how a lookup box is interpreted, what a saved
 * reply may contain, and how a reply is filled in for one person. Pure, so it
 * is unit-tested under Node, used by the edge function to validate on save,
 * and used by the browser to fill replies in (one list of placeholders, one
 * implementation).
 */

export const MACRO_CATEGORIES = ["account", "billing", "privacy", "how_to", "other"] as const;
export type MacroCategory = (typeof MACRO_CATEGORIES)[number];

/** Placeholders a reply may use, and what each one means. */
export const MACRO_VARIABLES = {
  first_name: "Their first name (or \"there\" if unknown)",
  email: "The email on their account",
  signup_date: "The day they signed up",
  trial_end: "The day their trial ended or ends",
  period_end: "The day their current paid period ends",
} as const;
export type MacroVariable = keyof typeof MACRO_VARIABLES;

const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function variablesIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(VARIABLE_RE)) found.add(match[1].toLowerCase());
  return [...found];
}

export interface MacroInput {
  title?: unknown;
  category?: unknown;
  subject?: unknown;
  body?: unknown;
  active?: unknown;
}

export type MacroResult =
  | { ok: true; value: { title: string; category: MacroCategory; subject: string; body: string; active?: boolean } }
  | { ok: false; error: string };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Checks a saved reply before it is stored. `partial` allows leaving fields out (an edit that only toggles `active`). */
export function validateMacro(input: MacroInput, partial = false): MacroResult {
  const out: Record<string, unknown> = {};

  if (!partial || input.title !== undefined) {
    const title = clean(input.title);
    if (title.length < 3 || title.length > 80) return { ok: false, error: "Give the reply a title of 3 to 80 characters" };
    out.title = title;
  }
  if (!partial || input.category !== undefined) {
    if (!MACRO_CATEGORIES.includes(input.category as MacroCategory)) return { ok: false, error: "Choose a category" };
    out.category = input.category;
  }
  if (!partial || input.subject !== undefined) {
    const subject = clean(input.subject);
    if (subject.length < 3 || subject.length > 150) return { ok: false, error: "The subject must be 3 to 150 characters" };
    if (/[\r\n]/.test(subject)) return { ok: false, error: "The subject must be a single line" };
    out.subject = subject;
  }
  if (!partial || input.body !== undefined) {
    const body = clean(input.body);
    if (body.length < 10 || body.length > 4000) return { ok: false, error: "The message must be 10 to 4000 characters" };
    out.body = body;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") return { ok: false, error: "active must be true or false" };
    out.active = input.active;
  }

  const unknown = variablesIn(`${out.subject ?? ""}\n${out.body ?? ""}`).filter((v) => !(v in MACRO_VARIABLES));
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")}` };
  }

  return { ok: true, value: out as { title: string; category: MacroCategory; subject: string; body: string; active?: boolean } };
}

export type MacroValues = Partial<Record<MacroVariable, string | null | undefined>>;

/**
 * Fills a reply in for one person. A placeholder with no value is left visible
 * as [[trial_end]] and reported in `missing`, so nobody sends a literal
 * "{{trial_end}}" or an empty gap to a customer.
 */
export function renderMacro(
  macro: { subject: string; body: string },
  values: MacroValues,
): { subject: string; body: string; missing: string[] } {
  const missing = new Set<string>();
  const fill = (text: string) =>
    text.replace(VARIABLE_RE, (_all, raw: string) => {
      const key = raw.toLowerCase() as MacroVariable;
      const value = values[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
      missing.add(key);
      return `[[${key}]]`;
    });
  return { subject: fill(macro.subject), body: fill(macro.body), missing: [...missing] };
}

export type LookupKind = "too_short" | "uuid" | "paystack_code" | "text";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYSTACK_RE = /^(CUS|SUB)_[a-z0-9]{6,}$/i;

/** What the support search box was given: an account id, a Paystack customer/subscription code, or a name/email fragment. */
export function classifyQuery(raw: unknown): { kind: LookupKind; q: string } {
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  if (UUID_RE.test(q)) return { kind: "uuid", q: q.toLowerCase() };
  if (PAYSTACK_RE.test(q)) return { kind: "paystack_code", q };
  if (q.length < 3) return { kind: "too_short", q };
  return { kind: "text", q };
}
