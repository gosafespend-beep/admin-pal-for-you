import { corsFor, forbidden } from "../_shared/guard.ts";
import { errorResponse, json, requireAdmin } from "../_shared/http.ts";

/**
 * Billing overview: MRR / ARR estimate, customers by source, trials, churn and
 * the things that look wrong. The numbers come from one SQL function
 * (public.admin_billing_overview, migration 06) so every screen agrees; the
 * existing entitlement health checks are attached unchanged.
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

    const [overview, health] = await Promise.all([
      ctx.adminClient.rpc("admin_billing_overview"),
      ctx.adminClient.rpc("entitlement_health"),
    ]);
    if (overview.error) throw overview.error;
    if (health.error) console.error("entitlement_health:", health.error.message);

    return json({ ...overview.data, health: health.data ?? [], generatedAt: new Date().toISOString() }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-billing");
  }
});
