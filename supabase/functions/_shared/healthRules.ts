/**
 * Is the platform healthy? Turns live service checks and database facts into
 * plain-language findings.
 *
 * Pure, so it is unit-tested and shared by the System health page and the
 * monitor (which emails about the same things the page shows).
 *
 * What it deliberately does NOT do: alarm about quiet data. This app has few
 * users, so "no app events for a day" or "no store events this week" is normal
 * and would cry wolf. Those timestamps are shown on the page for a person to
 * judge. Only things that must happen on a schedule (exchange rates) are
 * judged by age.
 */

export type Severity = "problem" | "warning" | "info" | "ok";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface ServiceCheck {
  key: string;
  label: string;
  /** "unknown" means we could not tell (for example a send-only key that cannot read domains). */
  status: "ok" | "warning" | "problem" | "unknown";
  latencyMs: number | null;
  detail: string;
}

export interface HealthSignals {
  generatedAt: string;
  db: { sizeBytes: number; connections: number; maxConnections: number };
  freshness: {
    fxRatesAt: string | null;
    lastEventAt: string | null;
    lastSignupAt: string | null;
    lastStoreEventAt: string | null;
    lastPaystackUpdateAt: string | null;
  };
  cron: { failed24h: Array<{ job: string; failures: number; last: string; message: string }> };
  http: { since: string | null; total: number; failures: Array<{ status: string; count: number; sample: string }> };
}

export interface HealthReport {
  generatedAt: string;
  services: ServiceCheck[];
  signals: HealthSignals;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Exchange rates are refreshed daily at 03:00; allow a day and a half before calling it late. */
export const FX_LATE_HOURS = 36;
export const FX_VERY_LATE_DAYS = 7;
export const CONNECTIONS_WARN_RATIO = 0.8;
export const SLOW_DB_MS = 1500;

const dayText = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2, ok: 3 };

export function assessHealth(r: HealthReport, now: Date = new Date()): Finding[] {
  const out: Finding[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string) => out.push({ id, severity, title, detail });
  const s = r.signals;

  for (const svc of r.services) {
    if (svc.status === "problem" || svc.status === "warning") {
      add(`service-${svc.key}`, svc.status, `${svc.label}: ${svc.status === "problem" ? "not working" : "has a problem"}`, svc.detail);
    }
  }

  if (s.db.maxConnections > 0 && s.db.connections / s.db.maxConnections >= CONNECTIONS_WARN_RATIO) {
    add("db-connections", "warning", "The database is close to its connection limit",
      `${s.db.connections} of ${s.db.maxConnections} connections are in use. New requests may start failing if it runs out.`);
  }

  const fx = s.freshness.fxRatesAt;
  if (!fx) {
    add("fx-stale", "warning", "No exchange rates on record", "Multi-currency totals can't be converted until the daily rate refresh has run.");
  } else {
    const age = now.getTime() - new Date(fx).getTime();
    if (age > FX_VERY_LATE_DAYS * DAY) {
      add("fx-stale", "problem", "Exchange rates are over a week old", `Last updated ${dayText(fx)}. Multi-currency totals are using stale rates.`);
    } else if (age > FX_LATE_HOURS * HOUR) {
      add("fx-stale", "warning", "Exchange rates are late", `They refresh daily and were last updated ${dayText(fx)}.`);
    }
  }

  for (const c of s.cron.failed24h) {
    add(`cron-${c.job}`, "warning", `Scheduled job "${c.job}" failed ${plural(c.failures, "time")} in the last day`, c.message || "No message recorded.");
  }

  const failedCalls = s.http.failures.reduce((n, f) => n + f.count, 0);
  if (failedCalls > 0) {
    const top = [...s.http.failures].sort((a, b) => b.count - a.count)[0];
    add("http-failures", "warning", `${plural(failedCalls, "call")} from scheduled jobs got an error back`,
      `Most common answer: ${top.status}${top.sample ? ` (${top.sample})` : ""}. A job shows "succeeded" once its call is sent, so this is where a failing job shows up. Only the last few hours are kept.`);
  }

  const quiet = s.freshness.lastEventAt && now.getTime() - new Date(s.freshness.lastEventAt).getTime() > 3 * DAY;
  if (quiet) {
    add("events-quiet", "info", "No app activity events for over 3 days", `The last one was ${dayText(s.freshness.lastEventAt!)}. With few users that can be normal.`);
  }

  if (!out.some((f) => f.severity === "problem" || f.severity === "warning")) {
    add("healthy", "ok", "Everything checked is healthy", `${plural(r.services.length, "service")} answered and scheduled jobs are running.`);
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
