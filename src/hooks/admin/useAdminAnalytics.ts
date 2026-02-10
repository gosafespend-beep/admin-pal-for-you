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

export interface AnalyticsData {
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
