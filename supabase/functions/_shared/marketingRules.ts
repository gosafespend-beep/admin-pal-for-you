/**
 * What is wrong with the automated marketing system, in plain words.
 *
 * Reads the report from admin_marketing_overview() and turns it into findings.
 * Pure, so it is unit-tested and can be reused later by a scheduled alert job:
 * the console and the alerts will then always agree about what "broken" means.
 *
 * A scheduled job shows "succeeded" when its HTTP call was sent, not when the
 * work worked, so job status is never used to decide health. The signals are
 * the agent run log, the last post per channel, and token expiry dates.
 */

export type Severity = "problem" | "warning" | "info" | "ok";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface MarketingOverview {
  generatedAt: string;
  publishing: { lastPublishedAt: string | null; byChannel: Array<{ channel: string; last: string | null; published30d: number }> };
  runs: {
    last24h: { ok: number; failed: number };
    last7d: { ok: number; failed: number };
    lastSuccessAt: string | null;
    failing: Array<{ agent: string; action: string; failures: number; lastFailureAt: string; lastError: string; lastSuccessAt: string | null }>;
  };
  queue: {
    byStatus: Array<{ status: string; count: number; oldest: string | null; newest: string | null }>;
    scheduledOverdue: number;
    reviewsPending: number;
  };
  incidents: Array<{ id: string; agent: string | null; kind: string; severity: string; summary: string; createdAt: string }>;
  spend: {
    daily: Array<{ day: string; cost: number; runs: number; failed: number }>;
    agents: Array<{
      id: string; codename: string; status: string; tier: number; capUsdDay: number | null;
      runs30d: number; failed30d: number; cost30d: number; costToday: number; lastRunAt: string | null;
    }>;
  };
  channels: Array<{
    platform: string; handle: string | null; enabled: boolean; healthOk: boolean | null; healthDetail: string;
    checkedAt: string | null; tokenExpiresAt: string | null; tokenUpdatedAt: string | null;
  }>;
  jobs: Array<{ name: string; schedule: string; active: boolean; target: string; lastRunAt: string | null; lastStatus: string | null }>;
  flags: Array<{ key: string; value: string; updatedAt: string }>;
  topPosts: Array<{ channel: string; format: string | null; postedAt: string; views: number; reach: number | null; engagementRate: number | null; caption: string }>;
}

export type ErrorKind = "credits" | "rate_limit" | "auth" | "parse" | "other";

/** Groups a run error into a cause a person can act on. */
export function classifyError(message: string | null | undefined): ErrorKind {
  const m = (message ?? "").toLowerCase();
  if (/credit balance|insufficient (credit|fund|quota)|billing|payment required|quota exceeded|exceeded your current quota/.test(m)) return "credits";
  if (/rate.?limit|too many requests|\b429\b|overloaded/.test(m)) return "rate_limit";
  if (/unauthori[sz]ed|invalid.*(api key|token)|\b401\b|\b403\b|permission|expired/.test(m)) return "auth";
  if (/json|unexpected token|no json object|parse/.test(m)) return "parse";
  return "other";
}

/** The scheduled job that renews each channel's login token, if the system has one. */
export const TOKEN_REFRESH_JOB: Record<string, string> = {
  instagram: "ig-token-refresh",
  threads: "threads-token-refresh",
};

const DAY = 24 * 60 * 60 * 1000;
const RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2, ok: 3 };

const dayText = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const daysBetween = (from: string, now: Date) => Math.floor((now.getTime() - new Date(from).getTime()) / DAY);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function assessMarketing(o: MarketingOverview, now: Date = new Date()): Finding[] {
  const out: Finding[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string) => out.push({ id, severity, title, detail });
  const enabled = o.channels.filter((c) => c.enabled);

  // ---- are runs failing, and why --------------------------------------------
  const recentFailures = o.runs.failing;
  const failedTotal = recentFailures.reduce((n, f) => n + f.failures, 0);
  const creditFailures = recentFailures.filter((f) => classifyError(f.lastError) === "credits");
  const creditsOut = creditFailures.length > 0 && o.runs.last7d.ok === 0;
  if (creditsOut) {
    const since = creditFailures.map((f) => f.lastFailureAt).sort().at(-1);
    add("ai-credits", "problem", "The AI provider is refusing every run: the credit balance is too low",
      `No run has succeeded in the last 7 days (${plural(o.runs.last7d.failed, "failure")}${since ? `, latest ${dayText(since)}` : ""}). ` +
      "Add credit to the AI account the marketing agents use. Nothing will be written or posted until then.");
  } else if (o.runs.last24h.failed > 0 && o.runs.last24h.ok === 0) {
    const top = recentFailures[0];
    add("runs-failing", "problem", "Every marketing run in the last 24 hours failed",
      top ? `Most common: ${top.agent} ${top.action} (${plural(top.failures, "failure")}). Last error: ${top.lastError || "none recorded"}` : "Check the failing runs below.");
  } else if (o.runs.last24h.failed > 0 && o.runs.last24h.failed >= o.runs.last24h.ok) {
    add("runs-flaky", "warning", "Half or more of the recent runs failed",
      `${o.runs.last24h.failed} failed and ${o.runs.last24h.ok} succeeded in the last 24 hours.`);
  }
  const parseFailures = recentFailures.filter((f) => classifyError(f.lastError) === "parse").reduce((n, f) => n + f.failures, 0);
  if (!creditsOut && parseFailures >= 3) {
    add("parse-failures", "warning", "The AI sometimes returns text the system can't read",
      `${plural(parseFailures, "run")} failed this week because the reply wasn't valid JSON. Those posts were skipped.`);
  }

  // ---- has anything been posted --------------------------------------------
  if (enabled.length > 0) {
    const last = o.publishing.lastPublishedAt;
    if (!last) {
      add("never-posted", "problem", "Nothing has ever been posted", "Channels are switched on but the publish queue has no published posts.");
    } else if (daysBetween(last, now) >= 3) {
      add("stalled", "problem", `Nothing has been posted for ${plural(daysBetween(last, now), "day")}`,
        `The last post went out on ${dayText(last)}.${creditsOut ? " The AI credit problem above is the likely cause." : ""}`);
    }
  }

  // ---- channels and tokens -----------------------------------------------------
  for (const c of enabled) {
    if (c.healthOk === false) {
      add(`channel-${c.platform}`, "problem", `${c.platform} connection is failing`, c.healthDetail || "The last health check failed.");
    } else if (c.checkedAt && now.getTime() - new Date(c.checkedAt).getTime() > 2 * DAY) {
      add(`channel-stale-${c.platform}`, "warning", `${c.platform} hasn't been health-checked for over 2 days`, `Last checked ${dayText(c.checkedAt)}.`);
    }

    if (c.tokenExpiresAt) {
      const left = Math.floor((new Date(c.tokenExpiresAt).getTime() - now.getTime()) / DAY);
      const job = TOKEN_REFRESH_JOB[c.platform];
      const scheduled = job ? o.jobs.some((j) => j.target === job && j.active) : true;
      const note = scheduled ? "" : " Nothing in the scheduled jobs renews this login, so it needs renewing by hand.";
      if (left < 0) {
        add(`token-${c.platform}`, "problem", `${c.platform} login has expired`, `It expired on ${dayText(c.tokenExpiresAt)}. Posting there will fail until it is reconnected.${note}`);
      } else if (left < 7) {
        add(`token-${c.platform}`, left < 3 ? "problem" : "warning", `${c.platform} login expires in ${plural(left, "day")}`,
          `It expires on ${dayText(c.tokenExpiresAt)}; it was last renewed ${c.tokenUpdatedAt ? dayText(c.tokenUpdatedAt) : "at an unknown date"}.${note}`);
      }
    }
  }

  // ---- queue -----------------------------------------------------------------
  for (const s of o.queue.byStatus) {
    if ((s.status === "drafted" || s.status === "approved") && s.oldest && daysBetween(s.oldest, now) >= 7) {
      add(`queue-${s.status}`, "warning", `${plural(s.count, "post")} ${s.status === "approved" ? "approved but never sent" : "drafted but never approved"}`,
        `The oldest has been waiting since ${dayText(s.oldest)}.`);
    }
  }
  if (o.queue.scheduledOverdue > 0) {
    add("overdue", "warning", `${plural(o.queue.scheduledOverdue, "scheduled post")} past their time`, "They should have gone out more than an hour ago.");
  }
  if (o.queue.reviewsPending > 0) {
    add("reviews", "info", `${plural(o.queue.reviewsPending, "item")} waiting for your review`, "Nothing is blocked on them being slow, but they won't go out until decided.");
  }

  // ---- incidents ---------------------------------------------------------------
  for (const i of o.incidents) {
    add(`incident-${i.id}`, /high|critical|sev1|p1/i.test(i.severity) ? "problem" : "warning", `Open incident: ${i.kind}`, `${i.summary} (${dayText(i.createdAt)})`);
  }

  // ---- spend ---------------------------------------------------------------------
  for (const a of o.spend.agents) {
    if (a.capUsdDay && a.costToday >= a.capUsdDay * 0.9) {
      add(`cap-${a.id}`, "warning", `${a.codename} is at its daily spend cap`, `$${a.costToday.toFixed(2)} of $${a.capUsdDay.toFixed(2)} used today.`);
    }
  }

  // ---- settings --------------------------------------------------------------------
  const reportFrom = o.flags.find((f) => f.key === "report_from")?.value ?? "";
  if (/replace_with|your_domain|example\./i.test(reportFrom)) {
    add("report-sender", "warning", "The weekly report's sender address is still a placeholder", `It is set to "${reportFrom}", so report emails will not send.`);
  }

  if (!out.some((f) => f.severity === "problem" || f.severity === "warning")) {
    add("healthy", "ok", "The marketing system looks healthy", `${plural(o.runs.last7d.ok, "run")} succeeded in the last 7 days and posts are going out.`);
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
