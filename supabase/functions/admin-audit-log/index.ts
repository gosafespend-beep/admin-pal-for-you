import { corsFor, forbidden } from "../_shared/guard.ts";
import { logAuditStrict } from "../_shared/audit.ts";
import { clampInt, emailsFor, errorResponse, HttpError, json, requireAdmin, selectAll } from "../_shared/http.ts";

const EXPORT_RESOURCES = new Set(["users", "transactions", "subscriptions", "waitlist", "audit-log"]);

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

    // The browser builds CSV exports itself; it calls this first so every
    // export of personal data is on record (and is refused if it cannot be).
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.event !== "export" || !EXPORT_RESOURCES.has(body.resource)) throw new HttpError(400, "Unsupported event");
      const count = Number(body.count);
      if (!Number.isInteger(count) || count < 1 || count > 1_000_000) throw new HttpError(400, "Invalid count");
      await logAuditStrict(adminClient, {
        adminUserId: ctx.adminId,
        action: "export_csv",
        targetType: String(body.resource),
        targetId: String(body.resource),
        details: { count, filters: typeof body.filters === "object" && body.filters ? body.filters : {} },
        meta: ctx.meta,
      });
      return json({ success: true }, 200, cors);
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
      const pageSize = clampInt(url.searchParams.get("pageSize"), 30, 1, 100);
      const action = url.searchParams.get("action") || "";
      const targetType = url.searchParams.get("targetType") || "";
      const offset = (page - 1) * pageSize;

      let query = adminClient.from("admin_audit_log").select("*", { count: "exact" });
      if (action) query = query.eq("action", action);
      if (targetType) query = query.eq("target_type", targetType);
      query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const emails = await emailsFor(adminClient, (data || []).map((l: { admin_user_id: string }) => l.admin_user_id));
      const enriched = (data || []).map((entry: Record<string, unknown>) => ({
        ...entry,
        adminEmail: emails.get(entry.admin_user_id as string) || "Unknown",
      }));

      // Filter dropdowns list what is actually in the log rather than a fixed
      // list that drifts out of date.
      const rows = await selectAll(adminClient, "admin_audit_log", "action, target_type");
      const facets = {
        actions: [...new Set(rows.map((r) => r.action as string))].sort(),
        targetTypes: [...new Set(rows.map((r) => r.target_type as string))].sort(),
      };

      return json({ data: enriched, total: count || 0, page, pageSize, facets }, 200, cors);
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-audit-log");
  }
});
