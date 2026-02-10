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
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()

    const [usersResult, subscriptionsResult, expensesResult, incomesResult] = await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      adminClient.from('subscriptions').select('*'),
      adminClient.from('expenses').select('user_id, created_at, amount'),
      adminClient.from('incomes').select('user_id, created_at, amount'),
    ])

    const users = usersResult.data?.users || []
    const subscriptions = subscriptionsResult.data || []

    // --- Retention Funnel ---
    const totalRegistered = users.length
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Users with at least 1 transaction
    const expenseUserIds = new Set((expensesResult.data || []).map((e: { user_id: string }) => e.user_id))
    const incomeUserIds = new Set((incomesResult.data || []).map((i: { user_id: string }) => i.user_id))
    const usersWithTransactions = new Set([...expenseUserIds, ...incomeUserIds])
    
    const activeIn30d = users.filter((u: { last_sign_in_at: string | null }) =>
      u.last_sign_in_at && new Date(u.last_sign_in_at) >= thirtyDaysAgo
    ).length

    const retentionFunnel = {
      registered: totalRegistered,
      withTransactions: usersWithTransactions.size,
      activeIn30d,
    }

    // --- Churn Risk: active before but not in 14 days ---
    const churnRiskUsers = users
      .filter((u: { last_sign_in_at: string | null; created_at: string }) => {
        if (!u.last_sign_in_at) return false
        const lastSignIn = new Date(u.last_sign_in_at)
        return lastSignIn < fourteenDaysAgo && usersWithTransactions.has(u.id)
      })
      .slice(0, 20)
      .map((u: { id: string; email?: string; last_sign_in_at: string | null; created_at: string }) => {
        const sub = subscriptions.find((s: { user_id: string }) => s.user_id === u.id)
        return {
          id: u.id,
          email: u.email || 'Unknown',
          lastActive: u.last_sign_in_at,
          subscriptionStatus: sub?.status || 'none',
          joinedAt: u.created_at,
        }
      })

    // --- Subscription Lifecycle (last 6 months) ---
    const subscriptionLifecycle = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const label = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      // Count subs that were in each state during this month
      const active = subscriptions.filter((s: { status: string; created_at: string; current_period_start: string | null }) => {
        const created = new Date(s.created_at)
        return created < monthEnd && s.status === 'active'
      }).length
      const trialing = subscriptions.filter((s: { status: string; trial_start: string; trial_end: string }) => {
        const start = new Date(s.trial_start)
        return start < monthEnd && s.status === 'trialing'
      }).length
      const cancelled = subscriptions.filter((s: { status: string; cancelled_at: string | null }) => {
        if (!s.cancelled_at) return false
        const cancelDate = new Date(s.cancelled_at)
        return cancelDate >= monthStart && cancelDate < monthEnd
      }).length

      subscriptionLifecycle.push({ month: label, active, trialing, cancelled })
    }

    // --- Top Users by Activity ---
    const userActivityMap = new Map<string, number>()
    ;(expensesResult.data || []).forEach((e: { user_id: string }) => {
      userActivityMap.set(e.user_id, (userActivityMap.get(e.user_id) || 0) + 1)
    })
    ;(incomesResult.data || []).forEach((i: { user_id: string }) => {
      userActivityMap.set(i.user_id, (userActivityMap.get(i.user_id) || 0) + 1)
    })

    const topUsers = Array.from(userActivityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, txCount]) => {
        const user = users.find((u: { id: string }) => u.id === userId)
        const sub = subscriptions.find((s: { user_id: string }) => s.user_id === userId)
        return {
          id: userId,
          email: user?.email || 'Unknown',
          transactionCount: txCount,
          lastActive: user?.last_sign_in_at || null,
          subscriptionStatus: sub?.status || 'none',
        }
      })

    // --- Revenue Metrics ---
    const activeSubs = subscriptions.filter((s: { status: string }) => s.status === 'active').length
    const totalSubs = subscriptions.length
    const convertedOrChurned = subscriptions.filter((s: { status: string }) => ['active', 'cancelled', 'expired'].includes(s.status)).length
    const trialConversionRate = convertedOrChurned > 0 ? Math.round((activeSubs / convertedOrChurned) * 1000) / 10 : 0

    const analytics = {
      retentionFunnel,
      churnRiskUsers,
      subscriptionLifecycle,
      topUsers,
      revenue: {
        activeSubscriptions: activeSubs,
        totalSubscriptions: totalSubs,
        trialConversionRate,
      },
    }

    return new Response(JSON.stringify(analytics), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('admin-analytics error:', error)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
