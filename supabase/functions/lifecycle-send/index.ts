import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFor, forbidden } from "../_shared/guard.ts";
import { json } from "../_shared/http.ts";
import { sendLifecycleMail } from "../_shared/lifecycleMail.ts";
import {
  formatEmailDate, remainingToday, renderEmail, unsubscribePageUrl,
  type Audience, type TemplateKey,
} from "../_shared/lifecycleRules.ts";

/**
 * The scheduled sender (hourly, see migration 17). Auth is the Vault secret
 * checked by the database, exactly like ops-monitor.
 *
 * Modes (lifecycle_settings.mode):
 *   off      does nothing
 *   dry_run  works out who would be emailed and sends nothing, records nothing
 *   live     sends, within the daily limit
 *
 * Who is eligible is decided in the database (admin_lifecycle_candidates):
 * triggers that happened after the template was switched on, never an old
 * backlog, never someone who already got it, never two emails inside the gap,
 * and marketing email only to people who opted in. This function adds the daily
 * limit, rendering (a marketing email without an unsubscribe link is refused),
 * and the actual sending.
 */
const ORDER: TemplateKey[] = ["welcome", "trial_ending", "activation_nudge"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const provided = req.headers.get("x-cron-secret");
  if (!provided) return json({ error: "Forbidden" }, 403, cors);
  const { data: ok, error: secretError } = await admin.rpc("monitor_secret_matches", { candidate: provided });
  if (secretError || ok !== true) return json({ error: "Forbidden" }, 403, cors);

  try {
    const { data: settings, error: sErr } = await admin.from("lifecycle_settings").select("*").eq("id", 1).single();
    if (sErr || !settings) throw new Error(`reading lifecycle_settings failed: ${sErr?.message}`);
    if (settings.mode === "off") return json({ ok: true, mode: "off", sent: 0 }, 200, cors);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await admin.from("lifecycle_sends").select("id", { count: "exact", head: true })
      .eq("status", "sent").gte("created_at", startOfDay.toISOString());
    let remaining = remainingToday(settings.daily_cap, sentToday ?? 0);

    const { data: templates, error: tErr } = await admin.from("lifecycle_templates").select("*").eq("enabled", true).not("live_since", "is", null);
    if (tErr) throw new Error(`reading lifecycle_templates failed: ${tErr.message}`);
    type Tpl = { key: TemplateKey; subject: string; body: string; audience: Audience };
    const byKey = new Map<string, Tpl>(((templates ?? []) as Tpl[]).map((t) => [t.key, t] as [string, Tpl]));

    const summary = { ok: true, mode: settings.mode as string, sent: 0, failed: 0, wouldSend: {} as Record<string, number>, stoppedEarly: null as string | null };

    for (const key of ORDER) {
      const tpl = byKey.get(key);
      if (!tpl || remaining <= 0) continue;

      const { data: candidates, error: cErr } = await admin.rpc("admin_lifecycle_candidates", { p_key: key, p_limit: remaining });
      if (cErr) throw new Error(`candidates for ${key} failed: ${cErr.message}`);
      const people = (candidates ?? []) as Array<{ user_id: string; email: string; first_name: string | null; trial_end: string | null }>;

      if (settings.mode === "dry_run") {
        summary.wouldSend[key] = people.length;
        remaining -= people.length;
        continue;
      }

      for (const p of people) {
        let unsubscribeUrl: string | undefined;
        let oneClickUrl: string | undefined;
        if (tpl.audience === "marketing") {
          const { data: token } = await admin.rpc("lifecycle_unsub_token", { p_user: p.user_id });
          if (typeof token === "string") {
            unsubscribeUrl = unsubscribePageUrl(token);
            oneClickUrl = `${url}/functions/v1/lifecycle-unsubscribe?t=${encodeURIComponent(token)}`;
          }
        }

        const rendered = renderEmail(tpl, {
          first_name: p.first_name, app_url: settings.app_url,
          trial_end: p.trial_end ? formatEmailDate(p.trial_end) : null,
        }, { unsubscribeUrl });

        let status: "sent" | "failed" = "failed";
        let providerId: string | null = null;
        let error: string | null = null;
        let fatal = false;
        if (!rendered.ok) {
          error = rendered.error;
        } else {
          const res = await sendLifecycleMail({ to: p.email, subject: rendered.subject, html: rendered.html, text: rendered.text, oneClickUrl, pageUrl: unsubscribeUrl });
          if (res.ok) { status = "sent"; providerId = res.id ?? null; } else { error = res.error ?? "unknown"; fatal = !!res.fatal; }
        }

        const { error: logError } = await admin.from("lifecycle_sends").insert({
          user_id: p.user_id, template_key: key, status, provider_id: providerId, error: error?.slice(0, 300) ?? null,
        });
        if (logError) {
          // If we cannot record a send we must not send more: the next run could email the same person again.
          console.error("lifecycle-send: could not record a send:", logError.message);
          summary.stoppedEarly = "could not record sends";
          return json({ ...summary, ok: false }, 500, cors);
        }

        if (status === "sent") { summary.sent++; remaining--; } else summary.failed++;
        if (fatal) { summary.stoppedEarly = error; return json(summary, 200, cors); }
        if (remaining <= 0) break;
        await sleep(300);
      }
    }
    return json(summary, 200, cors);
  } catch (error) {
    console.error("lifecycle-send failed:", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "send_failed" }, 500, cors);
  }
});
