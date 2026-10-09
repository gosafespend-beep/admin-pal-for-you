import { corsFor, forbidden } from "../_shared/guard.ts";
import { clampInt, errorResponse, json, requireAdmin } from "../_shared/http.ts";

/**
 * Growth metrics: signups, the sign-up-to-paid funnel, retention, platform
 * split and acquisition, all counted in unique people from one SQL function
 * (public.admin_growth_metrics, migration 07) so every number has a single
 * definition. See that migration for what each step means.
 */
Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;

    const weeks = clampInt(new URL(req.url).searchParams.get("weeks"), 12, 1, 52);
    const { data, error } = await ctx.adminClient.rpc("admin_growth_metrics", { p_weeks: weeks });
    if (error) throw error;

    return json({ ...data, generatedAt: new Date().toISOString() }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-metrics");
  }
});
