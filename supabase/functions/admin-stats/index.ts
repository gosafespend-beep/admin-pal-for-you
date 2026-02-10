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

    const [
      overviewResult,
      monthlyResult,
      recentActivityResult,
      usersResult,
      subscriptionsResult,
    ] = await Promise.all([
      adminClient.rpc('admin_overview_stats'),
      adminClient.rpc('admin_monthly_transaction_stats'),
      adminClient.rpc('admin_recent_activity', { p_limit: 15 }),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      adminClient.from('subscriptions').select('status, trial_start, trial_end, current_period_start, current_period_end'),
    ])

    const overview = overviewResult.data || {}
    const users = usersResult.data?.users || []
    const subscriptions = subscriptionsResult.data || []

    const monthlyData = (monthlyResult.data || []).map((m: Record<string, unknown>) => ({
      month: m.month_key,
      label: m.month_label,
      expenses: Number(m.expense_total),
      income: Number(m.income_total),
      expenseCount: Number(m.expense_count),
      incomeCount: Number(m.income_count),
    }))

    // User signups over time (last 12 months)
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

    // Engagement: active users in last 7d and 30d
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const activeUsers7d = users.filter((u: { last_sign_in_at: string | null }) => 
      u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo
    ).length
    const activeUsers30d = users.filter((u: { last_sign_in_at: string | null }) => 
      u.last_sign_in_at && new Date(u.last_sign_in_at) >= thirtyDaysAgo
    ).length

    // New signups this week
    const newSignupsThisWeek = users.filter((u: { created_at: string }) => 
      new Date(u.created_at) >= sevenDaysAgo
    ).length

    // Subscription metrics
    const activeSubs = subscriptions.filter((s: { status: string }) => s.status === 'active').length
    const trialingSubs = subscriptions.filter((s: { status: string }) => s.status === 'trialing').length
    const cancelledSubs = subscriptions.filter((s: { status: string }) => s.status === 'cancelled').length
    const expiredSubs = subscriptions.filter((s: { status: string }) => s.status === 'expired').length
    const totalSubs = subscriptions.length

    // Trial conversion rate: active / (active + expired + cancelled) 
    const convertedOrChurned = activeSubs + expiredSubs + cancelledSubs
    const trialConversionRate = convertedOrChurned > 0 ? (activeSubs / convertedOrChurned) * 100 : 0

    // Avg transactions per user
    const totalTransactions = Number(overview.totalExpenses || 0) + Number(overview.totalIncomes || 0) + Number(overview.totalTransfers || 0)
    const avgTransactionsPerUser = users.length > 0 ? totalTransactions / users.length : 0

    // User trend
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
        totalTransactions,
        totalExpenses: Number(overview.totalExpenses || 0),
        totalIncomes: Number(overview.totalIncomes || 0),
        totalTransfers: Number(overview.totalTransfers || 0),
        totalExpenseAmount: Number(overview.totalExpenseAmount || 0),
        totalIncomeAmount: Number(overview.totalIncomeAmount || 0),
        platformVolume: Number(overview.totalExpenseAmount || 0) + Number(overview.totalIncomeAmount || 0),
        waitlistCount: Number(overview.waitlistCount || 0),
      },
      subscriptions: {
        total: totalSubs,
        active: activeSubs,
        trialing: trialingSubs,
        cancelled: cancelledSubs,
        expired: expiredSubs,
        trialConversionRate: Math.round(trialConversionRate * 10) / 10,
      },
      engagement: {
        activeUsers7d,
        activeUsers30d,
        newSignupsThisWeek,
        avgTransactionsPerUser: Math.round(avgTransactionsPerUser * 10) / 10,
      },
      trends: {
        userTrend: Math.round(userTrend * 10) / 10,
      },
      charts: {
        monthlyData,
        userSignups,
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
