import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { emailsFor, errorResponse, HttpError, json, requireAdmin } from "../_shared/http.ts";
import { sendLifecycleMail } from "../_shared/lifecycleMail.ts";
import {
  TEMPLATE_KEYS, formatEmailDate, maskEmail, renderEmail, unsubscribePageUrl,
  validateSettingsEdit, validateTemplateEdit, type Audience, type TemplateKey,
} from "../_shared/lifecycleRules.ts";

/**
 * Lifecycle email management.
 *
 *   GET                                       settings, the three templates with live numbers, recent sends
 *   POST {action:"preview", key}              what the email would look like (not sent)
 *   POST {action:"test", key}                 send it to the admin's own address, marked [TEST], not recorded as a real send
 *   POST {action:"update_template", key, subject?, body?, audience?, enabled?, reason?, confirmService?}
 *   POST {action:"update_settings", mode?, daily_cap?, min_gap_hours?, reason}
 *
 * Every change is audited first (fail closed). Switching a template on starts
 * its clock: it reaches only people whose trigger happens after that moment.
 * Sending to a recipient is never done from here; only the scheduled sender
 * (lifecycle-send) emails customers.
 */
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const isKey = (k: unknown): k is TemplateKey => TEMPLATE_KEYS.includes(k as TemplateKey);

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
      const { data, error } = await adminClient.rpc("admin_lifecycle_overview");
      if (error) throw error;
      const recent: Row[] = data?.recent ?? [];
      const emails = await emailsFor(adminClient, recent.map((r) => r.userId));
      return json({
        overview: {
          ...data,
          recent: recent.map((r) => ({ ...r, email: maskEmail(emails.get(r.userId)), userId: undefined })),
          emailConfigured: Boolean(Deno.env.get("RESEND_API_KEY")),
        },
      }, 200, cors);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    const body = await req.json().catch(() => ({}));
    const entry = (action: string, targetId: string, details: Row) => ({
      adminUserId: ctx.adminId, action, targetType: "lifecycle", targetId, details, meta: ctx.meta,
    });

    const loadTemplate = async (key: unknown) => {
      if (!isKey(key)) throw new HttpError(400, "Choose a message");
      const { data } = await adminClient.from("lifecycle_templates").select("*").eq("key", key).maybeSingle();
      if (!data) throw new HttpError(404, "Message not found");
      return data as { key: TemplateKey; subject: string; body: string; audience: Audience; enabled: boolean; live_since: string | null };
    };
    const { data: settings } = await adminClient.from("lifecycle_settings").select("*").eq("id", 1).single();
    const appUrl: string = settings?.app_url ?? "https://app.gosafespend.com";
    const sample = (t: { key: TemplateKey; subject: string; body: string; audience: Audience }) =>
      renderEmail(t, {
        first_name: "Alex", app_url: appUrl,
        trial_end: formatEmailDate(new Date(Date.now() + 2 * 86_400_000).toISOString()),
      }, { unsubscribeUrl: t.audience === "marketing" ? unsubscribePageUrl("preview-only") : undefined });

    // ---- preview / test (nothing goes to a customer) -----------------------------------
    if (body.action === "preview") {
      const r = sample(await loadTemplate(body.key));
      if (!r.ok) throw new HttpError(400, r.error);
      return json({ subject: r.subject, html: r.html }, 200, cors);
    }

    if (body.action === "test") {
      const tpl = await loadTemplate(body.key);
      const to = ctx.adminEmail;
      if (!to) throw new HttpError(400, "Your account has no email address to send the test to");
      const r = sample(tpl);
      if (!r.ok) throw new HttpError(400, r.error);
      await audited(adminClient, entry("lifecycle_test_send", tpl.key, { template: tpl.key }), async () => {
        const res = await sendLifecycleMail({ to, subject: `[TEST] ${r.subject}`, html: r.html, text: r.text });
        if (!res.ok) throw new HttpError(502, res.error ?? "The test email could not be sent");
      });
      return json({ success: true, sentTo: maskEmail(to) }, 200, cors);
    }

    // ---- template changes ---------------------------------------------------------------
    if (body.action === "update_template") {
      const tpl = await loadTemplate(body.key);
      const parsed = validateTemplateEdit(tpl.key, { subject: body.subject, body: body.body, audience: body.audience });
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const fields: Row = { ...parsed.value };

      if (parsed.value.audience === "service" && tpl.audience === "marketing") {
        // Sending this to everyone who has not opted out instead of only to those who opted in is a consent decision.
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (body.confirmService !== true || reason.length < 10) {
          throw new HttpError(400, "Say why this counts as an account email and confirm it (at least 10 characters)");
        }
      }
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean") throw new HttpError(400, "enabled must be true or false");
        fields.enabled = body.enabled;
        // Switching on starts the clock: only triggers from now on are eligible, never a backlog.
        if (body.enabled && !tpl.enabled) fields.live_since = new Date().toISOString();
      }
      if (Object.keys(fields).length === 0) throw new HttpError(400, "Nothing to change");

      await audited(
        adminClient,
        entry("lifecycle_template_update", tpl.key, {
          fields: Object.keys(fields).filter((f) => f !== "live_since"), enabled: fields.enabled ?? null,
          audience: fields.audience ?? null, reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : null,
        }),
        async () => {
          const { error } = await adminClient.from("lifecycle_templates")
            .update({ ...fields, updated_by: ctx.adminId, updated_at: new Date().toISOString() }).eq("key", tpl.key);
          if (error) throw error;
        },
      );
      return json({ success: true }, 200, cors);
    }

    // ---- sending mode and limits -----------------------------------------------------------
    if (body.action === "update_settings") {
      const parsed = validateSettingsEdit({ mode: body.mode, daily_cap: body.daily_cap, min_gap_hours: body.min_gap_hours });
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 10 || reason.length > 300) throw new HttpError(400, "Say why (10 to 300 characters)");
      if (parsed.value.mode === "live" && !Deno.env.get("RESEND_API_KEY")) {
        throw new HttpError(409, "Email is not set up on the server, so sending cannot be switched on");
      }
      await audited(adminClient, entry("lifecycle_settings_update", "settings", { ...parsed.value, reason }), async () => {
        const { error } = await adminClient.from("lifecycle_settings")
          .update({ ...parsed.value, updated_by: ctx.adminId, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-lifecycle");
  }
});
