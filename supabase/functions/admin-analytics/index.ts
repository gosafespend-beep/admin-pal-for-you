import { corsFor, forbidden } from "../_shared/guard.ts";
import { clampInt, errorResponse, json, listAllUsers, requireAdmin, selectAll } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;
    const { adminClient, userClient } = ctx;
    const now = new Date();

    const url = new URL(req.url);
    const trendDays = clampInt(url.searchParams.get("days"), 30, 1, 365);

    // Users and transactions are read in full (paged), not cut off at the first
    // 1,000, so the retention figures stay correct as the user base grows.
    const [
      users, subscriptions, expenseRows, incomeRows,
      funnelResult, timeseriesResult, featureUsageResult, dataHealthResult,
    ] = await Promise.all([
      listAllUsers(adminClient),
      selectAll(adminClient, "subscriptions", "*"),
      selectAll(adminClient, "expenses", "user_id"),
      selectAll(adminClient, "incomes", "user_id"),
      userClient.rpc("admin_event_funnel"),
      userClient.rpc("admin_event_timeseries", { p_days: trendDays }),
      userClient.rpc("admin_feature_usage"),
      userClient.rpc("admin_data_health"),
    ]);
    const expensesResult = { data: expenseRows };
    const incomesResult = { data: incomeRows };

    if (funnelResult.error) console.error('admin_event_funnel:', funnelResult.error.message)
    if (timeseriesResult.error) console.error('admin_event_timeseries:', timeseriesResult.error.message)
    if (featureUsageResult.error) console.error('admin_feature_usage:', featureUsageResult.error.message)
    if (dataHealthResult.error) console.error('admin_data_health:', dataHealthResult.error.message)


    // --- Retention Funnel ---
    const totalRegistered = users.length
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Users with at least 1 transaction
    const expenseUserIds = new Set((expensesResult.data).map((e: { user_id: string }) => e.user_id))
    const incomeUserIds = new Set((incomesResult.data).map((i: { user_id: string }) => i.user_id))
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
      .filter((u: { id: string; last_sign_in_at: string | null; created_at: string }) => {
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
    ;(expensesResult.data).forEach((e: { user_id: string }) => {
      userActivityMap.set(e.user_id, (userActivityMap.get(e.user_id) || 0) + 1)
    })
    ;(incomesResult.data).forEach((i: { user_id: string }) => {
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

    // --- Product analytics (from analytics_events) ---
    type TsRow = { day: string; event: string; count: number }
    const tsRows = (timeseriesResult.data || []) as TsRow[]
    const dayMap = new Map<string, { day: string; total: number; events: Record<string, number> }>()
    for (const r of tsRows) {
      const entry = dayMap.get(r.day) || { day: r.day, total: 0, events: {} }
      entry.total += Number(r.count)
      entry.events[r.event] = (entry.events[r.event] || 0) + Number(r.count)
      dayMap.set(r.day, entry)
    }
    const eventTrend = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day))

    const funnel = (funnelResult.data || {}) as Record<string, unknown>
    const withDropoff = (steps: Array<{ step: string; count: number }> | undefined) => {
      const list = steps || []
      const first = list[0]?.count || 0
      return list.map((s, i) => ({
        step: s.step,
        count: Number(s.count),
        pctOfFirst: first > 0 ? Math.round((Number(s.count) / first) * 1000) / 10 : 0,
        dropoffFromPrev: i === 0 || !list[i - 1]?.count
          ? 0
          : Math.round((1 - Number(s.count) / Number(list[i - 1].count)) * 1000) / 10,
      }))
    }

    const product = {
      trendDays,
      activationFunnel: withDropoff(funnel.activation as Array<{ step: string; count: number }>),
      monetizationFunnel: withDropoff(funnel.monetization as Array<{ step: string; count: number }>),
      purchaseOutcomes: (funnel.purchaseOutcomes as Record<string, number>) || { cancel: 0, fail: 0, restore: 0 },
      abandonBySteps: (funnel.abandonBySteps as Array<{ step: string; count: number }>) || [],
      eventTrend,
      featureUsage: (featureUsageResult.data || []) as Array<{
        event: string; total: number; unique_users: number; unique_sessions: number; last_seen: string | null
      }>,
    }

    const dataHealth = ((dataHealthResult.data || []) as Array<{
      source: string; row_count: number; last_record: string | null
    }>).map((d) => {
      const ageHours = d.last_record ? (now.getTime() - new Date(d.last_record).getTime()) / 3600000 : null
      return {
        source: d.source,
        rowCount: Number(d.row_count),
        lastRecord: d.last_record,
        status: Number(d.row_count) === 0 ? 'empty' : ageHours !== null && ageHours > 24 * 7 ? 'stale' : 'ok',
      }
    })

    const analytics = {
      product,
      dataHealth,
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

    return json(analytics, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-analytics");
  }
});
