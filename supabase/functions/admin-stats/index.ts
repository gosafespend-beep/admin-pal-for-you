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

    // All data fetched via SQL RPCs - no in-memory filtering
    const [
      overviewResult,
      monthlyResult,
      recentActivityResult,
      engagementResult,
      signupsChartResult,
      subscriptionsResult,
    ] = await Promise.all([
      adminClient.rpc('admin_overview_stats'),
      adminClient.rpc('admin_monthly_transaction_stats'),
      adminClient.rpc('admin_recent_activity', { p_limit: 15 }),
      adminClient.rpc('admin_user_engagement_stats'),
      adminClient.rpc('admin_user_signups_chart'),
      adminClient.from('subscriptions').select('status, trial_start, trial_end, current_period_start, current_period_end'),
    ])

    const overview = overviewResult.data || {}
    const engagement = engagementResult.data || {}
    const subscriptions = subscriptionsResult.data || []

    const monthlyData = (monthlyResult.data || []).map((m: Record<string, unknown>) => ({
      month: m.month_key,
      label: m.month_label,
      expenses: Number(m.expense_total),
      income: Number(m.income_total),
      expenseCount: Number(m.expense_count),
      incomeCount: Number(m.income_count),
    }))

    const userSignups = (signupsChartResult.data || []).map((s: Record<string, unknown>) => ({
      month: s.month_key,
      label: s.month_label,
      count: Number(s.signup_count),
    }))

    // Subscription metrics
    const activeSubs = subscriptions.filter((s: { status: string }) => s.status === 'active').length
    const trialingSubs = subscriptions.filter((s: { status: string }) => s.status === 'trialing').length
    const cancelledSubs = subscriptions.filter((s: { status: string }) => s.status === 'cancelled').length
    const expiredSubs = subscriptions.filter((s: { status: string }) => s.status === 'expired').length
    const totalSubs = subscriptions.length
    const convertedOrChurned = activeSubs + expiredSubs + cancelledSubs
    const trialConversionRate = convertedOrChurned > 0 ? (activeSubs / convertedOrChurned) * 100 : 0

    // Derived from RPCs
    const totalUsers = Number(engagement.total_users || 0)
    const totalTransactions = Number(overview.totalExpenses || 0) + Number(overview.totalIncomes || 0) + Number(overview.totalTransfers || 0)
    const avgTransactionsPerUser = totalUsers > 0 ? totalTransactions / totalUsers : 0

    const currentMonthSignups = Number(engagement.current_month_signups || 0)
    const prevMonthSignups = Number(engagement.prev_month_signups || 0)
    const userTrend = prevMonthSignups > 0 ? ((currentMonthSignups - prevMonthSignups) / prevMonthSignups) * 100 : 0

    const stats = {
      overview: {
        totalUsers,
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
        activeUsers7d: Number(engagement.active_7d || 0),
        activeUsers30d: Number(engagement.active_30d || 0),
        newSignupsThisWeek: Number(engagement.new_this_week || 0),
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
