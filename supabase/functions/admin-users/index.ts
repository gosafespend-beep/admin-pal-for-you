import { corsFor, forbidden } from "../_shared/guard.ts";
import { clampInt, errorResponse, json, requireAdmin } from "../_shared/http.ts";

/**
 * Users list. Filtering, sorting, pagination and counts happen in one SQL
 * statement (public.admin_list_users, migration 03) instead of paging every
 * auth user through the admin API and filtering in memory on each request.
 * The function validates inputs; the SQL whitelists the sort column and
 * escapes the search term.
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

    const url = new URL(req.url);
    const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
    const pageSize = clampInt(url.searchParams.get("pageSize"), 20, 1, 100);

    const { data, error } = await ctx.adminClient.rpc("admin_list_users", {
      p_search: (url.searchParams.get("search") || "").trim().slice(0, 100),
      p_role: url.searchParams.get("role") || "",
      p_verified: url.searchParams.get("verified") || "",
      p_status: url.searchParams.get("status") || "",
      p_sort: url.searchParams.get("sortBy") || "created_at",
      p_order: url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (error) throw error;

    return json({ ...data, page, pageSize }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-users");
  }
});
