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

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Use SQL aggregation functions instead of loading all rows
    const [
      overviewResult,
      monthlyResult,
      categoriesResult,
      accountTypesResult,
      recentActivityResult,
      usersResult,
    ] = await Promise.all([
      adminClient.rpc('admin_overview_stats'),
      adminClient.rpc('admin_monthly_transaction_stats'),
      adminClient.rpc('admin_top_categories', { p_limit: 10 }),
      adminClient.rpc('admin_account_types'),
      adminClient.rpc('admin_recent_activity', { p_limit: 15 }),
      adminClient.auth.admin.listUsers(),
    ])

    const overview = overviewResult.data || {}
    const users = usersResult.data?.users || []
    const monthlyData = (monthlyResult.data || []).map((m: Record<string, unknown>) => ({
      month: m.month_key,
      label: m.month_label,
      expenses: Number(m.expense_total),
      income: Number(m.income_total),
      expenseCount: Number(m.expense_count),
      incomeCount: Number(m.income_count),
    }))

    // User signups over time (last 12 months) — still from auth users
    const now = new Date()
    const userSignups = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const count = users.filter((u: { created_at: string }) => {
        const createdAt = new Date(u.created_at)
        return createdAt >= date && createdAt < nextMonth
      }).length

      userSignups.push({
        month: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
      })
    }

    // Compute trends
    const expenseTrend = overview.prevMonthExpenses > 0
      ? ((overview.currentMonthExpenses - overview.prevMonthExpenses) / overview.prevMonthExpenses) * 100
      : 0
    const incomeTrend = overview.prevMonthIncomes > 0
      ? ((overview.currentMonthIncomes - overview.prevMonthIncomes) / overview.prevMonthIncomes) * 100
      : 0

    // Users trend: current month signups vs prev month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const currentMonthUsers = users.filter((u: { created_at: string }) => new Date(u.created_at) >= currentMonthStart).length
    const prevMonthUsers = users.filter((u: { created_at: string }) => {
      const d = new Date(u.created_at)
      return d >= prevMonthStart && d < currentMonthStart
    }).length
    const userTrend = prevMonthUsers > 0 ? ((currentMonthUsers - prevMonthUsers) / prevMonthUsers) * 100 : 0

    const stats = {
      overview: {
        totalUsers: users.length,
        activeProfiles: Number(overview.totalProfiles || 0),
        totalTransactions: Number(overview.totalExpenses) + Number(overview.totalIncomes) + Number(overview.totalTransfers),
        totalExpenses: Number(overview.totalExpenses),
        totalIncomes: Number(overview.totalIncomes),
        totalTransfers: Number(overview.totalTransfers),
        totalExpenseAmount: Number(overview.totalExpenseAmount),
        totalIncomeAmount: Number(overview.totalIncomeAmount),
        platformVolume: Number(overview.totalExpenseAmount) + Number(overview.totalIncomeAmount),
        waitlistCount: Number(overview.waitlistCount),
      },
      features: {
        totalAccounts: Number(overview.totalAccounts),
        totalBills: Number(overview.totalBills),
        activeBills: Number(overview.activeBills),
        totalDebts: Number(overview.totalDebts),
        activeDebts: Number(overview.activeDebts),
        totalDebtBalance: Number(overview.totalDebtBalance),
        totalSavingsGoals: Number(overview.totalSavingsGoals),
        completedGoals: Number(overview.completedGoals),
        totalSavingsProgress: Number(overview.totalSavingsProgress),
        totalSavingsTarget: Number(overview.totalSavingsTarget),
        totalCategories: Number(overview.totalCategories),
        // New metrics
        totalBudgets: Number(overview.totalBudgets),
        totalRecurring: Number(overview.totalRecurring),
        activeRecurring: Number(overview.activeRecurring),
        recurringMonthlyAmount: Number(overview.recurringMonthlyAmount),
        totalSubscriptions: Number(overview.totalSubscriptions),
        activeTrials: Number(overview.activeTrials),
        activeSubscriptions: Number(overview.activeSubscriptions),
        totalAssets: Number(overview.totalAssets),
        totalLiabilities: Number(overview.totalLiabilities),
        netWorth: Number(overview.netWorth),
        totalDebtPayments: Number(overview.totalDebtPayments),
        totalDebtPaymentAmount: Number(overview.totalDebtPaymentAmount),
        totalGoalContributions: Number(overview.totalGoalContributions),
        totalGoalContributionAmount: Number(overview.totalGoalContributionAmount),
      },
      trends: {
        userTrend: Math.round(userTrend * 10) / 10,
        expenseTrend: Math.round(expenseTrend * 10) / 10,
        incomeTrend: Math.round(incomeTrend * 10) / 10,
      },
      charts: {
        monthlyData,
        userSignups,
        topCategories: (categoriesResult.data || []).map((c: Record<string, unknown>) => ({
          category: c.category,
          amount: Number(c.total_amount),
        })),
        accountTypes: (accountTypesResult.data || []).map((a: Record<string, unknown>) => ({
          type: a.account_type,
          count: Number(a.count),
        })),
      },
      recentActivity: (recentActivityResult.data || []).map((a: Record<string, unknown>) => ({
        id: a.id,
        type: a.type,
        amount: Number(a.amount),
        description: a.description,
        date: a.date,
        userId: a.user_id,
        createdAt: a.created_at,
      })),
    }

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in admin-stats function:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
