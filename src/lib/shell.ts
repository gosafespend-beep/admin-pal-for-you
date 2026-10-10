/**
 * Small pure helpers for the admin shell, kept out of the components so they can
 * be unit-tested: what a page is called, how serious the open alerts are, and how
 * to say "signups this month" without a misleading percentage.
 */

const TITLES: Array<[RegExp, string]> = [
  [/^\/dashboard$/, "Dashboard"],
  [/^\/users\/[^/]+$/, "User"],
  [/^\/users$/, "Users"],
  [/^\/support/, "Support"],
  [/^\/messages/, "Messages"],
  [/^\/waitlist/, "Waitlist"],
  [/^\/data-requests/, "Data requests"],
  [/^\/transactions/, "Transactions"],
  [/^\/billing/, "Billing"],
  [/^\/subscriptions/, "Subscriptions"],
  [/^\/blog\/(new|editor)/, "Blog editor"],
  [/^\/blog/, "Blog"],
  [/^\/growth/, "Growth"],
  [/^\/marketing/, "Marketing"],
  [/^\/analytics/, "Analytics"],
  [/^\/ebook/, "Ebook"],
  [/^\/audit-log/, "Audit log"],
  [/^\/system/, "System health"],
  [/^\/app-controls/, "App controls"],
  [/^\/alerts/, "Alerts"],
  [/^\/settings/, "Settings"],
];

export const APP_NAME = "Safe Spend Admin";

/** The page name for a route, used for the browser tab title and for announcing a page change. */
export function pageName(pathname: string): string {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Page";
}

export const documentTitle = (pathname: string) => `${pageName(pathname)} · ${APP_NAME}`;

export interface AlertLike {
  severity: "problem" | "warning";
  acknowledged_until: string | null;
}

export interface AlertSummary {
  /** Alerts that need someone, not counting the ones paused on purpose. */
  needsAttention: number;
  problems: number;
  warnings: number;
  /** Paused on purpose, shown separately so a pause never hides the fact something is open. */
  paused: number;
  tone: "none" | "warning" | "problem";
}

export function summarizeAlerts(active: AlertLike[], now: Date = new Date()): AlertSummary {
  const live = active.filter((a) => !(a.acknowledged_until && new Date(a.acknowledged_until) > now));
  const problems = live.filter((a) => a.severity === "problem").length;
  const warnings = live.filter((a) => a.severity === "warning").length;
  return {
    needsAttention: problems + warnings,
    problems,
    warnings,
    paused: active.length - live.length,
    tone: problems > 0 ? "problem" : warnings > 0 ? "warning" : "none",
  };
}

/** "5 so far this month, 12 last month". Honest where a percentage would compare a part-month with a whole one. */
export function signupsLine(thisMonth: number, lastMonth: number): string {
  const n = (v: number) => `${v} ${v === 1 ? "signup" : "signups"}`;
  return `${n(thisMonth)} so far this month, ${lastMonth} last month`;
}

/** Ended trials: subscriptions that are not active, trialing or cancelled, so they never turned into customers. */
export function endedTrials(sub: { total: number; active: number; trialing: number; cancelled: number }): number {
  return Math.max(0, sub.total - sub.active - sub.trialing - sub.cancelled);
}
