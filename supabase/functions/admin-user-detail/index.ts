import { corsFor, forbidden } from "../_shared/guard.ts";
import { errorResponse, HttpError, isUuid, json, requireAdmin } from "../_shared/http.ts";

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

    const userId = req.method === "POST"
      ? (await req.json().catch(() => ({}))).userId
      : new URL(req.url).searchParams.get("userId");
    if (!isUuid(userId)) throw new HttpError(400, "A valid userId is required");

    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !user) throw new HttpError(404, "User not found");

    // Fetch admin-relevant data only
    const [
      profileResult,
      settingsResult,
      rolesResult,
      expenseCountResult,
      incomeCountResult,
      transferCountResult,
      expensesResult,
      incomesResult,
      subscriptionResult,
      sessionsResult,
    ] = await Promise.all([
      adminClient.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.from('user_roles').select('*').eq('user_id', userId),
      adminClient.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('incomes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('transfers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('expenses').select('id, amount, category, date, note').eq('user_id', userId).order('date', { ascending: false }).limit(10),
      adminClient.from('incomes').select('id, amount, source, category, date, note').eq('user_id', userId).order('date', { ascending: false }).limit(10),
      adminClient.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.rpc('list_user_sessions', { p_user_id: userId }),
    ])

    const recentTransactions = ([
      ...(expensesResult.data || []).map((e: Record<string, unknown>) => ({ ...e, type: 'expense' as string })),
      ...(incomesResult.data || []).map((i: Record<string, unknown>) => ({ ...i, type: 'income' as string })),
    ] as Array<Record<string, unknown>>).sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime()).slice(0, 10)

    const userRoles = rolesResult.data?.map((r: Record<string, unknown>) => r.role) || []

    const response = {
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        banned_until: user.banned_until,
        display_name: profileResult.data?.display_name,
        avatar_url: profileResult.data?.avatar_url,
        currency: settingsResult.data?.currency || 'USD',
        theme: settingsResult.data?.theme || 'dark',
        date_format: settingsResult.data?.date_format || 'MM/dd/yyyy',
        roles: userRoles,
        is_admin: userRoles.includes('admin'),
      },
      activitySummary: {
        totalExpenses: expenseCountResult.count || 0,
        totalIncomes: incomeCountResult.count || 0,
        totalTransfers: transferCountResult.count || 0,
        totalTransactions: (expenseCountResult.count || 0) + (incomeCountResult.count || 0) + (transferCountResult.count || 0),
        lastActiveAt: user.last_sign_in_at,
        accountAge: user.created_at,
      },
      recentTransactions,
      subscription: subscriptionResult.data || null,
      sessions: (sessionsResult.data || []).map((s: Record<string, unknown>) => ({
        session_id: s.session_id,
        created_at: s.created_at,
        updated_at: s.updated_at,
        user_agent: s.user_agent,
        ip: s.ip,
      })),
    }

    return json(response, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-user-detail");
  }
});
