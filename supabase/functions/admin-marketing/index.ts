import { corsFor, forbidden } from "../_shared/guard.ts";
import { errorResponse, json, requireAdmin } from "../_shared/http.ts";

/**
 * The automated marketing system at a glance: when it last posted, whether its
 * runs are succeeding, what it spends, whether each channel's login is healthy,
 * and what the scheduled jobs are. Read-only.
 *
 * The report comes from admin_marketing_overview() (migration 10), which never
 * reads token values, only their expiry dates. It holds no personal data about
 * customers, so reads are not audited.
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
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);

    const { data, error } = await ctx.adminClient.rpc("admin_marketing_overview");
    if (error) throw error;
    return json({ overview: data }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-marketing");
  }
});
