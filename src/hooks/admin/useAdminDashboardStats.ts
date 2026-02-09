import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  features: {
    totalAccounts: number;
    totalBills: number;
    activeBills: number;
    totalDebts: number;
    activeDebts: number;
    totalDebtBalance: number;
    totalSavingsGoals: number;
    completedGoals: number;
    totalSavingsProgress: number;
    totalSavingsTarget: number;
    totalCategories: number;
    totalBudgets: number;
    totalRecurring: number;
    activeRecurring: number;
    recurringMonthlyAmount: number;
    totalSubscriptions: number;
    activeTrials: number;
    activeSubscriptions: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    totalDebtPayments: number;
    totalDebtPaymentAmount: number;
    totalGoalContributions: number;
    totalGoalContributionAmount: number;
  };
  trends: {
    userTrend: number;
    expenseTrend: number;
    incomeTrend: number;
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
    topCategories: Array<{
      category: string;
      amount: number;
    }>;
    accountTypes: Array<{
      type: string;
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
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-stats", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch stats");
      }

      return response.data;
    },
    staleTime: 30000,
  });
}
