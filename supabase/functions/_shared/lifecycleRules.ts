/**
 * Rules for lifecycle emails: what a template may say, how it is turned into an
 * email, and the limits on sending. Pure, so it is unit-tested; used by the
 * edge functions and by the browser (preview and editing share one list of
 * placeholders).
 *
 * Two kinds of email, and the difference matters:
 *   service    about the person's own account (welcome, trial ending)
 *   marketing  everything else; sent only to people who opted in, and always
 *              carries a one-click unsubscribe. A marketing email WITHOUT an
 *              unsubscribe link is refused at render time, so a bug elsewhere
 *              cannot send one.
 */

export const TEMPLATE_KEYS = ["welcome", "activation_nudge", "trial_ending"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type Audience = "service" | "marketing";
export type Mode = "off" | "dry_run" | "live";

export interface TemplateInfo {
  title: string;
  when: string;
  /** Placeholders this template may use. */
  variables: Array<"first_name" | "app_url" | "trial_end">;
  /** Audiences the template may be sent as. Only the nudge has a choice. */
  audiences: Audience[];
}

export const TEMPLATE_INFO: Record<TemplateKey, TemplateInfo> = {
  welcome: {
    title: "Welcome",
    when: "About 15 minutes after someone confirms and signs up",
    variables: ["first_name", "app_url"],
    audiences: ["service"],
  },
  activation_nudge: {
    title: "Log your first transaction",
    when: "3 days after sign-up, only if they still have not added an expense or income",
    variables: ["first_name", "app_url"],
    audiences: ["marketing", "service"],
  },
  trial_ending: {
    title: "Trial ending",
    when: "2 days before a free trial ends, only if they have not subscribed",
    variables: ["first_name", "app_url", "trial_end"],
    audiences: ["service"],
  },
};

export const VARIABLE_HINT: Record<string, string> = {
  first_name: "Their first name (or \"there\")",
  app_url: "A link to the app",
  trial_end: "The day their trial ends",
};

export const MIN_GAP_HOURS = { min: 1, max: 720 };
export const DAILY_CAP = { min: 1, max: 500 };

const VARIABLE_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;
const variablesIn = (text: string) => [...new Set([...text.matchAll(VARIABLE_RE)].map((m) => m[1].toLowerCase()))];

export interface TemplateEdit {
  subject?: unknown;
  body?: unknown;
  audience?: unknown;
}
export type EditResult =
  | { ok: true; value: { subject?: string; body?: string; audience?: Audience } }
  | { ok: false; error: string };

export function validateTemplateEdit(key: TemplateKey, input: TemplateEdit): EditResult {
  const info = TEMPLATE_INFO[key];
  const out: { subject?: string; body?: string; audience?: Audience } = {};

  if (input.subject !== undefined) {
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    if (subject.length < 3 || subject.length > 150) return { ok: false, error: "The subject must be 3 to 150 characters" };
    if (/[\r\n]/.test(subject)) return { ok: false, error: "The subject must be a single line" };
    out.subject = subject;
  }
  if (input.body !== undefined) {
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (body.length < 20 || body.length > 3000) return { ok: false, error: "The message must be 20 to 3000 characters" };
    out.body = body;
  }
  if (input.audience !== undefined) {
    if (input.audience !== "service" && input.audience !== "marketing") return { ok: false, error: "Unknown audience" };
    if (!info.audiences.includes(input.audience)) return { ok: false, error: `${info.title} is always sent as an account email` };
    out.audience = input.audience;
  }

  const bad = variablesIn(`${out.subject ?? ""}\n${out.body ?? ""}`).filter((v) => !(info.variables as string[]).includes(v));
  if (bad.length > 0) return { ok: false, error: `${bad.map((b) => `{{${b}}}`).join(", ")} can't be used in ${info.title}` };
  return { ok: true, value: out };
}

export interface SettingsEdit {
  mode?: unknown;
  daily_cap?: unknown;
  min_gap_hours?: unknown;
}
export type SettingsResult =
  | { ok: true; value: { mode?: Mode; daily_cap?: number; min_gap_hours?: number } }
  | { ok: false; error: string };

export function validateSettingsEdit(input: SettingsEdit): SettingsResult {
  const out: { mode?: Mode; daily_cap?: number; min_gap_hours?: number } = {};
  if (input.mode !== undefined) {
    if (input.mode !== "off" && input.mode !== "dry_run" && input.mode !== "live") return { ok: false, error: "Choose off, dry run or live" };
    out.mode = input.mode;
  }
  const int = (v: unknown, lo: number, hi: number, label: string): number | string => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : `${label} must be a whole number from ${lo} to ${hi}`;
  };
  if (input.daily_cap !== undefined) {
    const n = int(input.daily_cap, DAILY_CAP.min, DAILY_CAP.max, "The daily limit");
    if (typeof n === "string") return { ok: false, error: n };
    out.daily_cap = n;
  }
  if (input.min_gap_hours !== undefined) {
    const n = int(input.min_gap_hours, MIN_GAP_HOURS.min, MIN_GAP_HOURS.max, "The gap");
    if (typeof n === "string") return { ok: false, error: n };
    out.min_gap_hours = n;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "Nothing to change" };
  return { ok: true, value: out };
}

export interface RenderValues {
  first_name?: string | null;
  app_url: string;
  trial_end?: string | null;
}
export type RenderResult =
  | { ok: true; subject: string; text: string; html: string }
  | { ok: false; error: string };

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Formats a trial end for an email: "Oct 12, 2026" (UTC, so it never depends on the server's zone). */
export function formatEmailDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function renderEmail(
  tpl: { key: TemplateKey; subject: string; body: string; audience: Audience },
  values: RenderValues,
  opts: { unsubscribeUrl?: string } = {},
): RenderResult {
  if (tpl.audience === "marketing" && !opts.unsubscribeUrl) {
    return { ok: false, error: "A marketing email must have an unsubscribe link" };
  }
  const info = TEMPLATE_INFO[tpl.key];
  const map: Record<string, string | null | undefined> = {
    first_name: values.first_name?.trim() || "there",
    app_url: values.app_url,
    trial_end: values.trial_end,
  };
  let missing: string | null = null;
  const fill = (text: string) =>
    text.replace(VARIABLE_RE, (_all, raw: string) => {
      const k = raw.toLowerCase();
      const v = (info.variables as string[]).includes(k) ? map[k] : undefined;
      if (!v) { missing = missing ?? k; return ""; }
      return v;
    });
  const subject = fill(tpl.subject);
  const bodyText = fill(tpl.body);
  if (missing) return { ok: false, error: `No value for {{${missing}}}` };

  const footerText = tpl.audience === "marketing"
    ? `You are getting this because you chose to receive emails from Safe Spend. Unsubscribe: ${opts.unsubscribeUrl}`
    : "You are getting this email because you have a Safe Spend account.";
  const text = `${bodyText}\n\n--\n${footerText}`;

  const paragraphs = esc(bodyText).split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.55">${
      p.replace(/\n/g, "<br>").replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#059669">${u}</a>`)
    }</p>`).join("");
  const footerHtml = tpl.audience === "marketing"
    ? `You are getting this because you chose to receive emails from Safe Spend. <a href="${esc(opts.unsubscribeUrl!)}" style="color:#6B7280">Unsubscribe</a>`
    : esc(footerText);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#10B981;padding:18px 24px"><span style="color:#fff;font-size:18px;font-weight:600">Safe Spend</span></div>
<div style="padding:24px">${paragraphs}</div>
<div style="background:#F9FAFB;padding:14px 24px;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF">${footerHtml}</div>
</div></body></html>`;
  return { ok: true, subject, text, html };
}

/** How many more emails may go out today. */
export const remainingToday = (dailyCap: number, sentToday: number) => Math.max(0, dailyCap - sentToday);

/** "alex@example.com" -> "a***@example.com", for showing who was emailed without exposing addresses. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "unknown";
  const [local, domain] = email.split("@");
  return `${local.charAt(0)}***@${domain}`;
}

/** The page a recipient lands on from the unsubscribe link in an email. */
export const unsubscribePageUrl = (token: string) => `https://admin.gosafespend.com/unsubscribe?t=${encodeURIComponent(token)}`;
