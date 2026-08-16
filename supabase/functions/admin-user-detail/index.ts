import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFor, forbidden } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    let userId: string | null = null
    if (req.method === 'POST') {
      const body = await req.json()
      userId = body.userId
    } else {
      const url = new URL(req.url)
      userId = url.searchParams.get('userId')
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(userId)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

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
      adminClient.from('profiles').select('*').eq('user_id', userId).single(),
      adminClient.from('user_settings').select('*').eq('user_id', userId).single(),
      adminClient.from('user_roles').select('*').eq('user_id', userId),
      adminClient.from('expenses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('incomes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('transfers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      adminClient.from('expenses').select('id, amount, category, date, note').eq('user_id', userId).order('date', { ascending: false }).limit(10),
      adminClient.from('incomes').select('id, amount, source, category, date, note').eq('user_id', userId).order('date', { ascending: false }).limit(10),
      adminClient.from('subscriptions').select('*').eq('user_id', userId).single(),
      adminClient.rpc('list_user_sessions', { p_user_id: userId }),
    ])

    const recentTransactions = [
      ...(expensesResult.data || []).map((e: Record<string, unknown>) => ({ ...e, type: 'expense' })),
      ...(incomesResult.data || []).map((i: Record<string, unknown>) => ({ ...i, type: 'income' })),
    ].sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime()).slice(0, 10)

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

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in admin-user-detail:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
