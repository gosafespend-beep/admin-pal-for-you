import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { clampInt, errorResponse, escapeLike, HttpError, isUuid, json, requireAdmin } from "../_shared/http.ts";

// The sign-up forms write "waitlist" and "newsletter"; the older review flow
// used pending/approved/rejected. All are accepted so nothing existing breaks.
const STATUSES = ["waitlist", "newsletter", "pending", "approved", "rejected"];

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
      const url = new URL(req.url);
      const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
      const pageSize = clampInt(url.searchParams.get("pageSize"), 20, 1, 100);
      const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
      const status = url.searchParams.get("status") || "";
      const offset = (page - 1) * pageSize;

      let q = adminClient.from("waitlist").select("*", { count: "exact" });
      if (search) q = q.ilike("email", `%${escapeLike(search)}%`);
      if (status) q = q.eq("status", status);
      q = q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

      const { data, count, error } = await q;
      if (error) throw error;

      // Counts per status, whatever statuses exist, over the whole table.
      const statusCounts: Record<string, number> = { total: 0 };
      for (let from = 0; ; from += 1000) {
        const { data: rows, error: e } = await adminClient.from("waitlist").select("status").range(from, from + 999);
        if (e) throw e;
        for (const r of rows ?? []) {
          statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
          statusCounts.total++;
        }
        if (!rows || rows.length < 1000) break;
      }

      return json({ data, total: count || 0, page, pageSize, statusCounts }, 200, cors);
    }

    if (req.method === "PATCH") {
      const { id, status } = await req.json().catch(() => ({}));
      if (!isUuid(id)) throw new HttpError(400, "A valid id is required");
      if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid status");

      const { data: before } = await adminClient.from("waitlist").select("email, status").eq("id", id).maybeSingle();
      if (!before) throw new HttpError(404, "Entry not found");

      const data = await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: `waitlist_status_${status}`,
          targetType: "waitlist",
          targetId: id,
          details: { email: before.email, from: before.status, status },
          meta: ctx.meta,
        },
        async () => {
          const { data, error } = await adminClient
            .from("waitlist")
            .update({ status, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();
          if (error) throw error;
          return data;
        },
      );
      return json({ data }, 200, cors);
    }

    if (req.method === "DELETE") {
      const { id } = await req.json().catch(() => ({}));
      if (!isUuid(id)) throw new HttpError(400, "A valid id is required");

      const { data: entry } = await adminClient.from("waitlist").select("email, status").eq("id", id).maybeSingle();
      if (!entry) throw new HttpError(404, "Entry not found");

      await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: "waitlist_delete",
          targetType: "waitlist",
          targetId: id,
          details: { email: entry.email, status: entry.status },
          meta: ctx.meta,
        },
        async () => {
          const { error } = await adminClient.from("waitlist").delete().eq("id", id);
          if (error) throw error;
        },
      );
      return json({ success: true }, 200, cors);
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-waitlist");
  }
});
