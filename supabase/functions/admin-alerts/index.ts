import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { errorResponse, HttpError, json, requireAdmin } from "../_shared/http.ts";
import { runOpsMonitor } from "../_shared/opsMonitor.ts";

/**
 * The alerts the monitor has found.
 *
 *   GET                         active alerts, recently fixed ones, and where emails go
 *   POST {action: "check"}      run a check now (records, never emails)
 *   POST {action: "acknowledge", fingerprint, days, reason}   stop reminders for 1-30 days
 *   POST {action: "unacknowledge", fingerprint}                start reminders again
 *
 * Acknowledging is audited with the reason, because it silences a warning.
 */
const FIXED_WINDOW_DAYS = 14;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;
    const { adminClient } = ctx;

    if (req.method === "GET") {
      const { data, error } = await adminClient.from("ops_alerts").select("*").order("first_seen_at", { ascending: false });
      if (error) throw error;
      const cutoff = Date.now() - FIXED_WINDOW_DAYS * 86_400_000;
      const rows: Row[] = data ?? [];
      return json({
        active: rows
          .filter((r) => !r.resolved_at)
          .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "problem" ? -1 : 1)),
        fixed: rows
          .filter((r) => r.resolved_at && new Date(r.resolved_at).getTime() > cutoff)
          .sort((a, b) => String(b.resolved_at).localeCompare(String(a.resolved_at))),
        emailTo: Deno.env.get("ALERT_EMAIL") ?? "info@gosafespend.com",
        emailConfigured: Boolean(Deno.env.get("RESEND_API_KEY")),
        checkEvery: "30 minutes",
      }, 200, cors);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    const body = await req.json().catch(() => ({}));

    if (body.action === "check") {
      const result = await runOpsMonitor(adminClient, { notify: false });
      return json({ result }, 200, cors);
    }

    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint : "";
    if (!fingerprint || fingerprint.length > 120) throw new HttpError(400, "An alert is required");
    const { data: alert } = await adminClient
      .from("ops_alerts").select("fingerprint, title, resolved_at").eq("fingerprint", fingerprint).maybeSingle();
    if (!alert) throw new HttpError(404, "Alert not found");
    if (alert.resolved_at) throw new HttpError(409, "That alert is already fixed");

    const entry = (action: string, details: Row) => ({
      adminUserId: ctx.adminId, action, targetType: "ops_alert", targetId: fingerprint,
      details: { title: alert.title, ...details }, meta: ctx.meta,
    });

    if (body.action === "acknowledge") {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, "Choose 1 to 30 days");
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10) throw new HttpError(400, "Say why (at least 10 characters)");
      if (reason.length > 300) throw new HttpError(400, "Keep the reason under 300 characters");
      const until = new Date(Date.now() + days * 86_400_000).toISOString();
      await audited(adminClient, entry("alert_acknowledge", { days, reason }), async () => {
        const { error } = await adminClient.from("ops_alerts")
          .update({ acknowledged_until: until, acknowledged_by: ctx.adminId, acknowledged_reason: reason })
          .eq("fingerprint", fingerprint);
        if (error) throw error;
      });
      return json({ success: true, acknowledgedUntil: until }, 200, cors);
    }

    if (body.action === "unacknowledge") {
      await audited(adminClient, entry("alert_unacknowledge", {}), async () => {
        const { error } = await adminClient.from("ops_alerts")
          .update({ acknowledged_until: null, acknowledged_by: null, acknowledged_reason: null })
          .eq("fingerprint", fingerprint);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-alerts");
  }
});
