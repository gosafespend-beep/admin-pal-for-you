/**
 * One monitoring pass: look for problems, record them, email what is new.
 *
 * Used by the scheduled `ops-monitor` function (which emails) and by the
 * "Check now" button on the Alerts page (which records but does not email, so
 * pressing it can never spam the inbox).
 *
 * Order matters. State is saved BEFORE the email is sent, and a send is only
 * recorded after it succeeds. If the email fails (no API key, provider down),
 * the problem stays marked as not-yet-told-about and the next run tries again,
 * instead of being silently written off as notified.
 */
import type { AnyClient } from "./http.ts";
import { assessMarketing, type MarketingOverview } from "./marketingRules.ts";
import { loadPauses } from "./marketingPauses.ts";
import { collectHealth } from "./health.ts";
import { assessHealth } from "./healthRules.ts";
import {
  assessOpsSignals, composeEmail, reconcile,
  type Detected, type OpsSignals, type StoredAlert,
} from "./alertRules.ts";

export const ADMIN_URL = "https://admin.gosafespend.com";

export interface MonitorResult {
  found: number;
  notified: number;
  resolved: number;
  emailed: boolean;
  emailError: string | null;
}

export async function detectProblems(admin: AnyClient, now: Date): Promise<Detected[]> {
  const [overview, signals] = await Promise.all([
    admin.rpc("admin_marketing_overview"),
    admin.rpc("admin_ops_signals"),
  ]);
  if (overview.error) throw new Error(`admin_marketing_overview failed: ${overview.error.message}`);
  if (signals.error) throw new Error(`admin_ops_signals failed: ${signals.error.message}`);

  const marketing: Detected[] = assessMarketing({ ...(overview.data as MarketingOverview), pauses: await loadPauses(admin) }, now)
    .filter((f) => f.severity === "problem" || f.severity === "warning")
    .map((f) => ({
      fingerprint: `marketing:${f.id}`,
      source: "marketing",
      severity: f.severity as "problem" | "warning",
      title: f.title,
      detail: f.detail,
    }));
  return [...marketing, ...assessOpsSignals(signals.data as OpsSignals, now), ...(await detectHealthProblems(admin, now))];
}

/**
 * Platform health. If the checks themselves cannot run, that is reported as a
 * problem of its own rather than failing the whole monitor (which would hide
 * the marketing and security checks too).
 */
async function detectHealthProblems(admin: AnyClient, now: Date): Promise<Detected[]> {
  try {
    const report = await collectHealth(admin);
    return assessHealth(report, now)
      .filter((f) => f.severity === "problem" || f.severity === "warning")
      .map((f) => ({
        fingerprint: `health:${f.id}`,
        source: "health",
        severity: f.severity as "problem" | "warning",
        title: f.title,
        detail: f.detail,
      }));
  } catch (error) {
    console.error("ops-monitor: health checks could not run:", error instanceof Error ? error.message : error);
    return [{
      fingerprint: "health:checks-failed", source: "health", severity: "warning",
      title: "The platform health checks could not run",
      detail: "The monitor could not read the platform's health. Other checks still ran.",
    }];
  }
}

async function sendEmail(message: { subject: string; text: string; html: string }): Promise<string | null> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return "RESEND_API_KEY is not set";
  const to = Deno.env.get("ALERT_EMAIL") ?? "info@gosafespend.com";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Safe Spend Monitoring <info@gosafespend.com>", to: [to], ...message }),
    });
    if (!res.ok) return `Email provider answered ${res.status}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Email could not be sent";
  }
}

export async function runOpsMonitor(admin: AnyClient, opts: { notify: boolean; now?: Date }): Promise<MonitorResult> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  const found = await detectProblems(admin, now);
  const { data: existing, error: readError } = await admin.from("ops_alerts").select("*");
  if (readError) throw new Error(`reading ops_alerts failed: ${readError.message}`);
  const plan = reconcile(found, (existing ?? []) as StoredAlert[], now);

  if (plan.upserts.length > 0) {
    const { error } = await admin.from("ops_alerts").upsert(plan.upserts, { onConflict: "fingerprint" });
    if (error) throw new Error(`saving alerts failed: ${error.message}`);
  }
  if (plan.resolve.length > 0) {
    const { error } = await admin.from("ops_alerts").update({ resolved_at: nowIso }).in("fingerprint", plan.resolve);
    if (error) throw new Error(`resolving alerts failed: ${error.message}`);
  }

  const result: MonitorResult = { found: found.length, notified: 0, resolved: plan.resolve.length, emailed: false, emailError: null };
  if (!opts.notify || (plan.notify.length === 0 && plan.resolvedNow.length === 0)) return result;

  const sendError = await sendEmail(composeEmail(plan.notify, plan.resolvedNow, ADMIN_URL));
  if (sendError) {
    console.error("ops-monitor: email failed:", sendError);
    result.emailError = sendError;
    return result;
  }

  result.emailed = true;
  result.notified = plan.notify.length;
  for (const n of plan.notify) {
    const row = plan.upserts.find((u) => u.fingerprint === n.fingerprint);
    const { error } = await admin
      .from("ops_alerts")
      .update({ last_notified_at: nowIso, notify_count: (row?.notify_count ?? 0) + 1 })
      .eq("fingerprint", n.fingerprint);
    if (error) console.error("ops-monitor: recording the send failed:", error.message);
  }
  return result;
}

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

/** For the monitor's own failure: a plain email with no database involved. */
export async function sendMonitorFailure(message: string): Promise<void> {
  const error = await sendEmail({
    subject: "[Safe Spend] The monitor itself failed",
    text: `The monitoring check could not run:\n\n${message}\n\nUntil this is fixed, nothing is watching the system.`,
    html: `<p>The monitoring check could not run:</p><pre>${escapeHtml(message)}</pre><p>Until this is fixed, nothing is watching the system.</p>`,
  });
  if (error) console.error("ops-monitor: failure email also failed:", error);
}
