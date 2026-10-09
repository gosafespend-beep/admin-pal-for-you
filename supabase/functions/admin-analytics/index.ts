import { corsFor, forbidden } from "../_shared/guard.ts";
import { clampInt, errorResponse, json, requireAdmin } from "../_shared/http.ts";

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

    // Retention, churn risk, top users, lifecycle and revenue are computed in
    // SQL (public.admin_analytics_core, migration 03) rather than by reading every
    // user, expense and income row into the function.
    const [coreResult, funnelResult, timeseriesResult, featureUsageResult, dataHealthResult] = await Promise.all([
      adminClient.rpc("admin_analytics_core"),
      userClient.rpc("admin_event_funnel"),
      userClient.rpc("admin_event_timeseries", { p_days: trendDays }),
      userClient.rpc("admin_feature_usage"),
      userClient.rpc("admin_data_health"),
    ]);
    if (coreResult.error) throw coreResult.error;
    if (funnelResult.error) console.error("admin_event_funnel:", funnelResult.error.message);
    if (timeseriesResult.error) console.error("admin_event_timeseries:", timeseriesResult.error.message);
    if (featureUsageResult.error) console.error("admin_feature_usage:", featureUsageResult.error.message);
    if (dataHealthResult.error) console.error("admin_data_health:", dataHealthResult.error.message);
    const core = coreResult.data as {
      retentionFunnel: unknown; churnRiskUsers: unknown; topUsers: unknown; subscriptionLifecycle: unknown; revenue: unknown;
    };

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
      retentionFunnel: core.retentionFunnel,
      churnRiskUsers: core.churnRiskUsers,
      subscriptionLifecycle: core.subscriptionLifecycle,
      topUsers: core.topUsers,
      revenue: core.revenue,
    };

    return json(analytics, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-analytics");
  }
});
