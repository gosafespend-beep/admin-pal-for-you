import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(userId)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all related data in parallel — including new tabs data
    const [
      profileResult,
      settingsResult,
      rolesResult,
      accountsResult,
      expensesResult,
      incomesResult,
      transfersResult,
      debtsResult,
      savingsGoalsResult,
      categoriesResult,
      billsResult,
      budgetsResult,
      recurringResult,
      subscriptionResult,
      networthResult,
    ] = await Promise.all([
      adminClient.from('profiles').select('*').eq('user_id', userId).single(),
      adminClient.from('user_settings').select('*').eq('user_id', userId).single(),
      adminClient.from('user_roles').select('*').eq('user_id', userId),
      adminClient.from('accounts').select('*').eq('user_id', userId),
      adminClient.from('expenses').select('id, amount, category, date, note, reference_number').eq('user_id', userId).order('date', { ascending: false }).limit(20),
      adminClient.from('incomes').select('id, amount, source, category, date, note, reference_number').eq('user_id', userId).order('date', { ascending: false }).limit(20),
      adminClient.from('transfers').select('id, amount, date, note, reference_number').eq('user_id', userId).order('date', { ascending: false }).limit(10),
      adminClient.from('debts').select('*').eq('user_id', userId),
      adminClient.from('savings_goals').select('*').eq('user_id', userId),
      adminClient.from('categories').select('*').eq('user_id', userId),
      adminClient.from('bills').select('*').eq('user_id', userId).order('name'),
      adminClient.from('budgets').select('*, categories!budgets_category_id_fkey(name, color, icon)').eq('user_id', userId),
      adminClient.from('recurring_transactions').select('*').eq('user_id', userId).order('next_due'),
      adminClient.from('subscriptions').select('*').eq('user_id', userId).single(),
      adminClient.from('networth_snapshots').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(12),
    ])

    const accounts = accountsResult.data || []
    const expenses = expensesResult.data || []
    const incomes = incomesResult.data || []
    const transfers = transfersResult.data || []
    const debts = debtsResult.data || []
    const savingsGoals = savingsGoalsResult.data || []
    const bills = billsResult.data || []
    const budgets = budgetsResult.data || []
    const recurring = recurringResult.data || []

    const totalBalance = accounts.reduce((sum: number, acc: Record<string, unknown>) => sum + Number(acc.initial_balance || 0), 0)
    const totalExpenses = expenses.reduce((sum: number, exp: Record<string, unknown>) => sum + Number(exp.amount || 0), 0)
    const totalIncome = incomes.reduce((sum: number, inc: Record<string, unknown>) => sum + Number(inc.amount || 0), 0)
    const totalDebt = debts.reduce((sum: number, d: Record<string, unknown>) => sum + Number(d.current_balance || 0), 0)
    const totalSavings = savingsGoals.reduce((sum: number, g: Record<string, unknown>) => sum + Number(g.current_amount || 0), 0)

    const recentTransactions = [
      ...expenses.map((e: Record<string, unknown>) => ({ ...e, type: 'expense' })),
      ...incomes.map((i: Record<string, unknown>) => ({ ...i, type: 'income' })),
      ...transfers.map((t: Record<string, unknown>) => ({ ...t, type: 'transfer' })),
    ].sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime()).slice(0, 15)

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
      financialSummary: {
        totalBalance,
        totalExpenses,
        totalIncome,
        totalDebt,
        totalSavings,
        accountCount: accounts.length,
        debtCount: debts.filter((d: Record<string, unknown>) => d.is_active).length,
        savingsGoalCount: savingsGoals.length,
        categoryCount: categoriesResult.data?.length || 0,
        billCount: bills.length,
        activeBillCount: bills.filter((b: Record<string, unknown>) => b.is_active).length,
        budgetCount: budgets.length,
        recurringCount: recurring.length,
        activeRecurringCount: recurring.filter((r: Record<string, unknown>) => r.is_active).length,
      },
      accounts,
      debts,
      savingsGoals,
      recentTransactions,
      bills,
      budgets,
      recurringTransactions: recurring,
      subscription: subscriptionResult.data || null,
      networthSnapshots: networthResult.data || [],
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in admin-user-detail:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
