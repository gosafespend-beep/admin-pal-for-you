import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

export interface DashboardStats {
  overview: {
    totalUsers: number;
    activeProfiles: number;
    totalTransactions: number;
    totalExpenses: number;
    totalIncomes: number;
    totalTransfers: number;
    totalExpenseAmount: number;
    totalIncomeAmount: number;
    platformVolume: number;
    waitlistCount: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    cancelled: number;
    expired: number;
    trialConversionRate: number;
    /** Subscriptions that have either converted or churned; the rate is meaningless when this is small. */
    conversionSample: number;
  };
  engagement: {
    activeUsers7d: number;
    activeUsers30d: number;
    newSignupsThisWeek: number;
    avgTransactionsPerUser: number;
  };
  trends: {
    userTrend: number;
  };
  charts: {
    monthlyData: Array<{
      month: string;
      label: string;
      expenses: number;
      income: number;
      expenseCount: number;
      incomeCount: number;
    }>;
    userSignups: Array<{
      month: string;
      label: string;
      count: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    date: string;
    userId: string;
    createdAt: string;
  }>;
}

export function useAdminDashboardStats() {
  // Refreshes on a timer and on demand. (It used to hold six realtime
  // subscriptions on the customer tables open just to refetch this one query,
  // which refetched every aggregate on every customer insert.)
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: () => invokeAdmin<DashboardStats>("admin-stats"),
    staleTime: 60000,
    refetchInterval: 5 * 60000,
  });
}
