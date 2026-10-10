import { corsFor, forbidden } from "../_shared/guard.ts";
import { errorResponse, json, requireAdmin } from "../_shared/http.ts";
import { collectHealth } from "../_shared/health.ts";
import { assessHealth } from "../_shared/healthRules.ts";

/**
 * System health: whether each service answers, whether the platform's
 * scheduled work is happening, and what is wrong in plain words.
 *
 * Read-only. Provider checks make one cheap authenticated call each and return
 * only a fixed status sentence, never provider data (see _shared/health.ts).
 * No customer data is involved, so reads are not audited.
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

    const report = await collectHealth(ctx.adminClient);
    return json({ report, findings: assessHealth(report) }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-health");
  }
});
