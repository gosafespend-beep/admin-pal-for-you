import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { errorResponse, HttpError, json, requireAdmin } from "../_shared/http.ts";
import { explainRefusal, validateControl } from "../_shared/marketingControlRules.ts";
import { loadPauses } from "../_shared/marketingPauses.ts";

/**
 * The automated marketing system.
 *
 *   GET                  the overview (see migration 10) plus anything currently paused
 *   POST {action, scope, target?, reason}
 *        action  "pause" | "resume"
 *        scope   "agent" | "channel" | "all"
 *
 * The overview never reads token values, only their expiry dates, and holds no
 * customer data, so reads are not audited. Pausing and resuming are: the intent
 * is written to the audit log first, and if that write fails nothing is changed.
 *
 * What the switches really do (checked against the functions that obey them):
 *   agent    status "paused": agent-run refuses it, so it writes and spends nothing
 *   channel  enabled=false: publish-direct posts only to enabled channels
 */
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
      const [overview, pauses] = await Promise.all([adminClient.rpc("admin_marketing_overview"), loadPauses(adminClient)]);
      if (overview.error) throw overview.error;
      return json({ overview: { ...overview.data, pauses } }, 200, cors);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

    const parsed = validateControl(await req.json().catch(() => null));
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    const c = parsed.value;

    const rpc = c.scope === "all"
      ? () => adminClient.rpc(c.action === "pause" ? "admin_marketing_pause_all" : "admin_marketing_resume_all", { p_admin: ctx.adminId, p_reason: c.reason })
      : c.action === "pause"
        ? () => adminClient.rpc("admin_marketing_pause", { p_scope: c.scope, p_target: c.target, p_admin: ctx.adminId, p_reason: c.reason })
        : () => adminClient.rpc("admin_marketing_resume", { p_scope: c.scope, p_target: c.target, p_admin: ctx.adminId, p_reason: c.reason });

    const result = await audited(
      adminClient,
      {
        adminUserId: ctx.adminId,
        action: `marketing_${c.action}`,
        targetType: "marketing",
        targetId: c.scope === "all" ? "all" : `${c.scope}:${c.target}`,
        details: { scope: c.scope, target: c.target ?? null, reason: c.reason },
        meta: ctx.meta,
      },
      async () => {
        const { data, error } = await rpc();
        if (error) {
          const refusal = explainRefusal(error.message ?? "");
          if (refusal) throw new HttpError(refusal.status, refusal.error);
          throw error;
        }
        return data as Record<string, unknown>;
      },
      (r) => ({ result: r }),
    );
    return json({ success: true, result }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-marketing");
  }
});
