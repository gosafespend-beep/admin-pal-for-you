import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { errorResponse, HttpError, json, requireAdmin } from "../_shared/http.ts";
import { validateBanner, validateFlag, validateVersions, compareVersions, type Control } from "../_shared/controlRules.ts";

/**
 * The product control plane.
 *
 *   GET                                         the banner, versions, flags, and which app versions people really use
 *   POST {action:"update_banner", ...fields, reason, confirm?}
 *   POST {action:"update_versions", platform, latest, min, storeUrl, reason, confirm?}
 *   POST {action:"upsert_flag", key, description, enabled, rolloutPct, platforms, public, reason}
 *   POST {action:"delete_flag", key, reason}
 *
 * Every change is audited first (fail closed). Two changes can affect every
 * customer at once and so need an explicit confirm as well as a reason:
 * switching on a maintenance screen (the app becomes unusable), and raising the
 * oldest allowed version (people on older versions are told to update).
 */
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const reasonOf = (body: Row, min: number) => {
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < min || reason.length > 300) throw new HttpError(400, `Say why (${min} to 300 characters)`);
  return reason;
};

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

    const loadControl = async () => {
      const { data, error } = await adminClient.from("app_control").select("*").eq("id", 1).single();
      if (error || !data) throw error ?? new Error("app_control row missing");
      return data as Control & Row;
    };

    if (req.method === "GET") {
      const [control, flags, versions] = await Promise.all([
        loadControl(),
        adminClient.from("app_flags").select("*").order("key"),
        adminClient.rpc("admin_app_versions", { p_days: 30 }),
      ]);
      if (flags.error) throw flags.error;
      if (versions.error) throw versions.error;
      return json({ control, flags: flags.data ?? [], versionsInUse: versions.data ?? [] }, 200, cors);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    const body = await req.json().catch(() => ({}));
    const entry = (action: string, targetId: string, details: Row) => ({
      adminUserId: ctx.adminId, action, targetType: "app_control", targetId, details, meta: ctx.meta,
    });
    const stamp = { updated_by: ctx.adminId, updated_at: new Date().toISOString() };

    // ---- banner / maintenance ---------------------------------------------------------------
    if (body.action === "update_banner") {
      const parsed = validateBanner({ active: body.active, kind: body.kind, severity: body.severity, message: body.message, startsAt: body.startsAt, endsAt: body.endsAt });
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const v = parsed.value;
      const reason = reasonOf(body, 10);
      if (v.active && v.kind === "maintenance" && body.confirm !== true) {
        throw new HttpError(400, "A maintenance screen stops everyone using the app. Confirm that you mean it.");
      }
      await audited(adminClient, entry("app_banner_update", "banner", { active: v.active, kind: v.kind, severity: v.severity, message: v.message, startsAt: v.startsAt, endsAt: v.endsAt, reason }), async () => {
        const { error } = await adminClient.from("app_control").update({
          banner_active: v.active, banner_kind: v.kind, banner_severity: v.severity, banner_message: v.message,
          banner_starts_at: v.startsAt, banner_ends_at: v.endsAt, ...stamp,
        }).eq("id", 1);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    // ---- versions ------------------------------------------------------------------------------
    if (body.action === "update_versions") {
      const parsed = validateVersions({ platform: body.platform, latest: body.latest, min: body.min, storeUrl: body.storeUrl });
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const v = parsed.value;
      const reason = reasonOf(body, 10);
      const current = await loadControl();
      const currentMin = current[`${v.platform}_min`] as string | null;
      // Raising the minimum (or setting one for the first time) tells people on older versions to update.
      const raising = !!v.min && (!currentMin || (compareVersions(v.min, currentMin) ?? 0) > 0);
      if (raising && body.confirm !== true) {
        throw new HttpError(400, "Raising the oldest allowed version tells everyone on older versions to update before they can carry on. Confirm that you mean it.");
      }
      await audited(adminClient, entry("app_versions_update", v.platform, { platform: v.platform, latest: v.latest, min: v.min, storeUrl: v.storeUrl, previousMin: currentMin, reason }), async () => {
        const { error } = await adminClient.from("app_control").update({
          [`${v.platform}_latest`]: v.latest, [`${v.platform}_min`]: v.min, [`${v.platform}_store_url`]: v.storeUrl, ...stamp,
        }).eq("id", 1);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    // ---- flags -----------------------------------------------------------------------------------
    if (body.action === "upsert_flag") {
      const parsed = validateFlag({ key: body.key, description: body.description, enabled: body.enabled, rolloutPct: body.rolloutPct, platforms: body.platforms, public: body.public });
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const f = parsed.value;
      const reason = reasonOf(body, 5);
      await audited(adminClient, entry("app_flag_upsert", f.key, { ...f, reason }), async () => {
        const { error } = await adminClient.from("app_flags").upsert({ ...f, ...stamp }, { onConflict: "key" });
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    if (body.action === "delete_flag") {
      const key = typeof body.key === "string" ? body.key : "";
      if (!/^[a-z][a-z0-9_]{2,40}$/.test(key)) throw new HttpError(400, "Choose a flag");
      const reason = reasonOf(body, 5);
      const { data: existing } = await adminClient.from("app_flags").select("key").eq("key", key).maybeSingle();
      if (!existing) throw new HttpError(404, "Flag not found");
      await audited(adminClient, entry("app_flag_delete", key, { reason }), async () => {
        const { error } = await adminClient.from("app_flags").delete().eq("key", key);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    throw new HttpError(400, "Unknown action");
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-controls");
  }
});
