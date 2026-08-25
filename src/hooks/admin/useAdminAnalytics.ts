import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RetentionFunnel {
  registered: number;
  withTransactions: number;
  activeIn30d: number;
}

export interface ChurnRiskUser {
  id: string;
  email: string;
  lastActive: string | null;
  subscriptionStatus: string;
  joinedAt: string;
}

export interface SubscriptionLifecyclePoint {
  month: string;
  active: number;
  trialing: number;
  cancelled: number;
}

export interface TopUser {
  id: string;
  email: string;
  transactionCount: number;
  lastActive: string | null;
  subscriptionStatus: string;
}

export interface FunnelStep {
  step: string;
  count: number;
  pctOfFirst: number;
  dropoffFromPrev: number;
}

export interface EventTrendPoint {
  day: string;
  total: number;
  events: Record<string, number>;
}

export interface FeatureUsageRow {
  event: string;
  total: number;
  unique_users: number;
  unique_sessions: number;
  last_seen: string | null;
}

export interface ProductAnalytics {
  trendDays: number;
  activationFunnel: FunnelStep[];
  monetizationFunnel: FunnelStep[];
  purchaseOutcomes: { cancel: number; fail: number; restore: number };
  abandonBySteps: Array<{ step: string; count: number }>;
  eventTrend: EventTrendPoint[];
  featureUsage: FeatureUsageRow[];
}

export interface DataHealthRow {
  source: string;
  rowCount: number;
  lastRecord: string | null;
  status: "ok" | "stale" | "empty";
}

export interface AnalyticsData {
  product: ProductAnalytics;
  dataHealth: DataHealthRow[];
  retentionFunnel: RetentionFunnel;
  churnRiskUsers: ChurnRiskUser[];
  subscriptionLifecycle: SubscriptionLifecyclePoint[];
  topUsers: TopUser[];
  revenue: {
    activeSubscriptions: number;
    totalSubscriptions: number;
    trialConversionRate: number;
  };
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async (): Promise<AnalyticsData> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-analytics", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch analytics");
      return response.data;
    },
    staleTime: 60000,
  });
}
