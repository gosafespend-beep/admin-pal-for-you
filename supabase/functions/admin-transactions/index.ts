import { corsFor, forbidden } from "../_shared/guard.ts";
import { logReadOnce } from "../_shared/audit.ts";
import { clampInt, errorResponse, HttpError, isUuid, json, orSearchTerm, requireAdmin, type AnyClient } from "../_shared/http.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Row = { user_id: string; account_id?: string | null; from_account_id?: string | null };

/**
 * Amounts are in each account's own currency (the app is multi-currency), so
 * every row carries the currency to show next to it: the account's currency,
 * else the owner's default currency, else USD. Previously the panel printed a
 * hard-coded "KES" next to everything.
 */
async function withCurrency<T extends Row>(adminClient: AnyClient, rows: T[], accountKey: "account_id" | "from_account_id") {
  const accountIds = [...new Set(rows.map((r) => r[accountKey]).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [accounts, settings] = await Promise.all([
    accountIds.length ? adminClient.from("accounts").select("id, currency").in("id", accountIds) : { data: [] },
    userIds.length ? adminClient.from("user_settings").select("user_id, currency").in("user_id", userIds) : { data: [] },
  ]);
  const byAccount = new Map((accounts.data ?? []).map((a: { id: string; currency: string }) => [a.id, a.currency]));
  const byUser = new Map((settings.data ?? []).map((s: { user_id: string; currency: string }) => [s.user_id, s.currency]));
  return rows.map((r) => ({
    ...r,
    currency: (r[accountKey] && byAccount.get(r[accountKey] as string)) || byUser.get(r.user_id) || "USD",
  }));
}

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
    const type = url.searchParams.get("type") || "all";
    const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
    const pageSize = clampInt(url.searchParams.get("pageSize"), 20, 1, 100);
    const search = orSearchTerm(url.searchParams.get("search") || "");
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    const userId = url.searchParams.get("userId") || "";
    const offset = (page - 1) * pageSize;

    if (startDate && !DATE_RE.test(startDate)) throw new HttpError(400, "startDate must be YYYY-MM-DD");
    if (endDate && !DATE_RE.test(endDate)) throw new HttpError(400, "endDate must be YYYY-MM-DD");
    if (userId && !isUuid(userId)) throw new HttpError(400, "userId must be a valid id");

    // Looking at one person's transactions is a targeted read of personal data.
    if (userId) {
      await logReadOnce(adminClient, {
        adminUserId: ctx.adminId,
        action: "view_user_transactions",
        targetType: "user",
        targetId: userId,
        meta: ctx.meta,
      });
    }

    const results: Record<string, unknown> = {};

    const run = async (
      key: "expenses" | "incomes" | "transfers",
      columns: string,
      searchColumns: string[],
      accountKey: "account_id" | "from_account_id",
    ) => {
      let q = adminClient.from(key).select(columns, { count: "exact" });
      if (search) q = q.or(searchColumns.map((c) => `${c}.ilike.%${search}%`).join(","));
      if (startDate) q = q.gte("date", startDate);
      if (endDate) q = q.lte("date", endDate);
      if (userId) q = q.eq("user_id", userId);
      q = q.order("date", { ascending: false }).range(offset, offset + pageSize - 1);
      const { data, count, error } = await q;
      if (error) {
        console.error(`[admin-transactions] ${requestId} ${key}`, error.message);
        results[key] = { data: [], total: 0, error: "Could not load this list" };
        return;
      }
      results[key] = { data: await withCurrency(adminClient, (data ?? []) as unknown as Row[], accountKey), total: count || 0 };
    };

    await Promise.all([
      type === "all" || type === "expenses"
        ? run("expenses", "id, amount, category, date, note, reference_number, user_id, account_id, created_at", ["category", "note", "reference_number"], "account_id")
        : null,
      type === "all" || type === "incomes"
        ? run("incomes", "id, amount, source, category, date, note, reference_number, user_id, account_id, created_at", ["source", "note", "reference_number"], "account_id")
        : null,
      type === "all" || type === "transfers"
        ? run("transfers", "id, amount, date, note, reference_number, user_id, from_account_id, created_at", ["note", "reference_number"], "from_account_id")
        : null,
    ]);

    return json({ page, pageSize, ...results }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-transactions");
  }
});
