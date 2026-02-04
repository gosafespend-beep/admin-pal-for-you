import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlatformStats {
  totalUsers: number;
  activeProfiles: number;
  totalExpenses: number;
  totalExpenseAmount: number;
  totalIncomes: number;
  totalIncomeAmount: number;
  totalAccounts: number;
  totalBills: number;
  totalDebts: number;
  totalSavingsGoals: number;
  waitlistCount: number;
  totalTransfers: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async (): Promise<PlatformStats> => {
      // Fetch all stats in parallel
      const [
        profilesResult,
        expensesResult,
        expensesSumResult,
        incomesResult,
        incomesSumResult,
        accountsResult,
        billsResult,
        debtsResult,
        savingsGoalsResult,
        waitlistResult,
        transfersResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("expenses").select("id", { count: "exact", head: true }),
        supabase.from("expenses").select("amount"),
        supabase.from("incomes").select("id", { count: "exact", head: true }),
        supabase.from("incomes").select("amount"),
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        supabase.from("bills").select("id", { count: "exact", head: true }),
        supabase.from("debts").select("id", { count: "exact", head: true }),
        supabase.from("savings_goals").select("id", { count: "exact", head: true }),
        supabase.rpc("get_waitlist_count"),
        supabase.from("transfers").select("id", { count: "exact", head: true }),
      ]);

      // Calculate totals
      const totalExpenseAmount = expensesSumResult.data?.reduce(
        (sum, e) => sum + Number(e.amount), 
        0
      ) || 0;

      const totalIncomeAmount = incomesSumResult.data?.reduce(
        (sum, i) => sum + Number(i.amount), 
        0
      ) || 0;

      return {
        totalUsers: profilesResult.count || 0,
        activeProfiles: profilesResult.count || 0,
        totalExpenses: expensesResult.count || 0,
        totalExpenseAmount,
        totalIncomes: incomesResult.count || 0,
        totalIncomeAmount,
        totalAccounts: accountsResult.count || 0,
        totalBills: billsResult.count || 0,
        totalDebts: debtsResult.count || 0,
        totalSavingsGoals: savingsGoalsResult.count || 0,
        waitlistCount: (waitlistResult.data as number) || 0,
        totalTransfers: transfersResult.count || 0,
      };
    },
    staleTime: 30000, // 30 seconds
  });
}
