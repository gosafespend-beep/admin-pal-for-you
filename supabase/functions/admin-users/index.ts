import { corsFor, forbidden } from "../_shared/guard.ts";
import { clampInt, errorResponse, json, listAllUsers, requireAdmin, selectAll } from "../_shared/http.ts";

const SORTABLE = new Set(["created_at", "last_sign_in_at", "email", "display_name", "updated_at"]);

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

    const url = new URL(req.url);
    const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
    const pageSize = clampInt(url.searchParams.get("pageSize"), 20, 1, 100);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase().slice(0, 100);
    const roleFilter = url.searchParams.get("role") || "";
    const verifiedFilter = url.searchParams.get("verified") || "";
    const statusFilter = url.searchParams.get("status") || "";
    const sortParam = url.searchParams.get("sortBy") || "created_at";
    const sortBy = SORTABLE.has(sortParam) ? sortParam : "created_at";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // The admin API has no server-side search or sort, so we page through every
    // user (not just the first 1,000) and filter in memory.
    const [users, profiles, settings, roles] = await Promise.all([
      listAllUsers(adminClient),
      selectAll(adminClient, "profiles", "user_id, display_name, avatar_url"),
      selectAll(adminClient, "user_settings", "user_id, currency, theme, date_format"),
      selectAll(adminClient, "user_roles", "user_id, role"),
    ]);

    const profilesMap = new Map(profiles.map((p) => [p.user_id, p]));
    const settingsMap = new Map(settings.map((s) => [s.user_id, s]));
    const rolesMap = new Map<string, string[]>();
    for (const r of roles) rolesMap.set(r.user_id, [...(rolesMap.get(r.user_id) ?? []), r.role]);

    const now = Date.now();
    const isSuspended = (u: { banned_until: string | null }) => Boolean(u.banned_until && new Date(u.banned_until).getTime() > now);

    const all = users.map((user) => {
      const profile = profilesMap.get(user.id);
      const s = settingsMap.get(user.id);
      const userRoles = rolesMap.get(user.id) ?? [];
      return {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        banned_until: user.banned_until,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
        currency: s?.currency || "USD",
        theme: s?.theme || "dark",
        date_format: s?.date_format || "MM/dd/yyyy",
        roles: userRoles,
        is_admin: userRoles.includes("admin"),
      };
    });

    let filtered = all;
    if (search) {
      filtered = filtered.filter((u) => u.email?.toLowerCase().includes(search) || u.display_name?.toLowerCase().includes(search));
    }
    if (roleFilter === "admin") filtered = filtered.filter((u) => u.is_admin);
    else if (roleFilter === "user") filtered = filtered.filter((u) => !u.is_admin);
    if (verifiedFilter === "verified") filtered = filtered.filter((u) => u.email_confirmed_at);
    else if (verifiedFilter === "unverified") filtered = filtered.filter((u) => !u.email_confirmed_at);
    if (statusFilter === "suspended") filtered = filtered.filter(isSuspended);
    else if (statusFilter === "active") filtered = filtered.filter((u) => !isSuspended(u));

    filtered.sort((a, b) => {
      const aVal = ((a as Record<string, unknown>)[sortBy] as string) || "";
      const bVal = ((b as Record<string, unknown>)[sortBy] as string) || "";
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === "desc" ? -cmp : cmp;
    });

    const offset = (page - 1) * pageSize;

    return json(
      {
        users: filtered.slice(offset, offset + pageSize),
        total: filtered.length,
        page,
        pageSize,
        // Whole-population figures: they used to be computed on the filtered
        // list, so the summary cards changed whenever a filter was applied.
        stats: {
          totalUsers: all.length,
          totalAdmins: all.filter((u) => u.is_admin).length,
          totalVerified: all.filter((u) => u.email_confirmed_at).length,
          totalSuspended: all.filter(isSuspended).length,
        },
      },
      200,
      cors,
    );
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-users");
  }
});
