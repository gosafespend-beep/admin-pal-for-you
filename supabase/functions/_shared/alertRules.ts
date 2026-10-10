/**
 * When to tell a person about a problem, and when to stay quiet.
 *
 * The monitor checks the system every 30 minutes, so most runs find the same
 * problems as the last one. These rules turn "what is wrong now" plus "what we
 * already know about" into: what to record, what to email, what has cleared.
 *
 *  - A problem is emailed only after it is seen on two runs in a row, so one
 *    failed request doesn't page anyone.
 *  - It is then re-sent as a reminder until fixed (daily for problems, every
 *    three days for warnings), so it can't be forgotten, and never in between.
 *  - A problem you have acknowledged stays quiet until the acknowledgement
 *    ends, unless it gets worse.
 *  - When a problem clears, the next email says so.
 *
 * Pure, so every one of those promises is a unit test.
 */

export type AlertSeverity = "problem" | "warning";

export interface Detected {
  /** Stable identity of the problem, e.g. "marketing:ai-credits". */
  fingerprint: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface StoredAlert {
  fingerprint: string;
  source: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  last_notified_at: string | null;
  notify_count: number;
  acknowledged_until: string | null;
  resolved_at: string | null;
}

export type NotifyReason = "new" | "reminder" | "worse";
export type ToNotify = Detected & { reason: NotifyReason };

export const CONFIRM_RUNS = 2;
export const REMINDER_HOURS: Record<AlertSeverity, number> = { problem: 24, warning: 72 };

const HOUR = 60 * 60 * 1000;

export interface Reconciled {
  /** Full rows to write for every problem found now. */
  upserts: StoredAlert[];
  /** Alerts that were active and are no longer found. */
  resolve: string[];
  /** Problems to email about (the caller records the send only once it succeeds). */
  notify: ToNotify[];
  /** Cleared alerts that someone had been emailed about, for the "fixed" section. */
  resolvedNow: StoredAlert[];
}

export function reconcile(found: Detected[], stored: StoredAlert[], now: Date = new Date()): Reconciled {
  const nowIso = now.toISOString();
  const byPrint = new Map(stored.map((s) => [s.fingerprint, s]));
  const seen = new Set<string>();
  const upserts: StoredAlert[] = [];
  const notify: ToNotify[] = [];

  for (const d of found) {
    if (seen.has(d.fingerprint)) continue;
    seen.add(d.fingerprint);
    const prev = byPrint.get(d.fingerprint);
    const active = prev && !prev.resolved_at;

    if (!active) {
      upserts.push({
        ...d, first_seen_at: nowIso, last_seen_at: nowIso, seen_count: 1,
        last_notified_at: null, notify_count: 0, acknowledged_until: null, resolved_at: null,
      });
      continue;
    }

    const worse = prev.severity === "warning" && d.severity === "problem";
    const acknowledged = !worse && !!prev.acknowledged_until && new Date(prev.acknowledged_until).getTime() > now.getTime();
    const row: StoredAlert = {
      ...d, first_seen_at: prev.first_seen_at, last_seen_at: nowIso, seen_count: prev.seen_count + 1,
      last_notified_at: prev.last_notified_at, notify_count: prev.notify_count,
      acknowledged_until: worse ? null : prev.acknowledged_until, resolved_at: null,
    };
    upserts.push(row);
    if (acknowledged) continue;

    if (worse && prev.last_notified_at) {
      notify.push({ ...d, reason: "worse" });
    } else if (!prev.last_notified_at) {
      if (row.seen_count >= CONFIRM_RUNS) notify.push({ ...d, reason: "new" });
    } else if (now.getTime() - new Date(prev.last_notified_at).getTime() >= REMINDER_HOURS[d.severity] * HOUR) {
      notify.push({ ...d, reason: "reminder" });
    }
  }

  const gone = stored.filter((s) => !s.resolved_at && !seen.has(s.fingerprint));
  return {
    upserts,
    resolve: gone.map((s) => s.fingerprint),
    notify,
    resolvedNow: gone.filter((s) => s.last_notified_at),
  };
}

// ---- platform checks that are not about marketing ------------------------------------------

export interface OpsSignals {
  admins: Array<{ userId: string; email: string | null; grantedAt: string }>;
  dataRequests: { overdue: number; dueSoon: number; oldestOverdue: string | null };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function assessOpsSignals(s: OpsSignals, now: Date = new Date()): Detected[] {
  const out: Detected[] = [];

  for (const a of s.admins) {
    if (now.getTime() - new Date(a.grantedAt).getTime() < 24 * HOUR) {
      out.push({
        fingerprint: `security:new-admin:${a.userId}`, source: "security", severity: "problem",
        title: "A new admin was added",
        detail: `${a.email ?? a.userId} was given admin access in the last 24 hours. If you didn't do this, remove it from their user page and change your password.`,
      });
    }
  }

  if (s.dataRequests.overdue > 0) {
    out.push({
      fingerprint: "privacy:requests-overdue", source: "privacy", severity: "problem",
      title: `${plural(s.dataRequests.overdue, "data request")} past the deadline`,
      detail: "Someone asked for their data to be sent, changed or deleted and the answer is late. Open Data requests.",
    });
  }
  if (s.dataRequests.dueSoon > 0) {
    out.push({
      fingerprint: "privacy:requests-due-soon", source: "privacy", severity: "warning",
      title: `${plural(s.dataRequests.dueSoon, "data request")} due within 7 days`,
      detail: "Open Data requests to deal with them before they become late.",
    });
  }
  return out;
}

// ---- the email --------------------------------------------------------------------------------

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const REASON: Record<NotifyReason, string> = { new: "New", reminder: "Still open", worse: "Got worse" };

export function composeEmail(
  notify: ToNotify[],
  resolved: Array<Pick<StoredAlert, "title">>,
  adminUrl: string,
): { subject: string; text: string; html: string } {
  const problems = notify.filter((n) => n.severity === "problem");
  const lead = problems[0] ?? notify[0];
  const subject = notify.length === 0
    ? `[Safe Spend] Fixed: ${resolved[0]?.title ?? "an earlier problem"}`
    : `[Safe Spend] ${problems.length > 0 ? "Problem" : "Warning"}: ${lead.title}${notify.length > 1 ? ` (+${notify.length - 1} more)` : ""}`;

  const text = [
    ...notify.map((n) => `[${n.severity.toUpperCase()} · ${REASON[n.reason]}] ${n.title}\n${n.detail}`),
    ...(resolved.length ? [`Fixed since the last email:\n${resolved.map((r) => `- ${r.title}`).join("\n")}`] : []),
    `Details: ${adminUrl}/alerts`,
  ].join("\n\n");

  const rows = notify.map((n) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7;vertical-align:top;font-weight:600;color:${n.severity === "problem" ? "#b91c1c" : "#a16207"}">${esc(n.severity.toUpperCase())}<br><span style="font-weight:400;color:#71717a;font-size:12px">${esc(REASON[n.reason])}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #e4e4e7"><strong>${esc(n.title)}</strong><br><span style="color:#3f3f46;font-size:14px">${esc(n.detail)}</span></td>
    </tr>`).join("");
  const fixed = resolved.length
    ? `<h2 style="font-size:15px;margin:24px 0 8px">Fixed since the last email</h2><ul style="color:#3f3f46;font-size:14px">${resolved.map((r) => `<li>${esc(r.title)}</li>`).join("")}</ul>`
    : "";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:18px;margin:0 0 16px">Safe Spend monitor</h1>
      ${notify.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>` : ""}
      ${fixed}
      <p style="margin-top:24px"><a href="${esc(adminUrl)}/alerts" style="color:#2563eb">Open the alerts page</a></p>
      <p style="color:#71717a;font-size:13px">You only get this when something new goes wrong, or as a reminder while it stays unfixed. Silence means nothing has changed.</p>
    </div>`;
  return { subject, text, html };
}
