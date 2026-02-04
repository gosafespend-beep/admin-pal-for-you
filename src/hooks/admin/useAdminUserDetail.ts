import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserDetail {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  theme: string;
  date_format: string;
  roles: string[];
  is_admin: boolean;
}

export interface FinancialSummary {
  totalBalance: number;
  totalExpenses: number;
  totalIncome: number;
  totalDebt: number;
  totalSavings: number;
  accountCount: number;
  debtCount: number;
  savingsGoalCount: number;
  categoryCount: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category?: string;
  note?: string;
  source?: string;
  type: 'expense' | 'income' | 'transfer';
}

export interface Account {
  id: string;
  name: string;
  type: string;
  initial_balance: number;
  color: string;
  is_active: boolean;
}

export interface Debt {
  id: string;
  name: string;
  current_balance: number;
  starting_balance: number;
  interest_rate: number;
  minimum_payment: number;
  is_active: boolean;
  color: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  is_completed: boolean;
  color: string;
  icon: string;
}

export interface UserDetailResponse {
  user: UserDetail;
  financialSummary: FinancialSummary;
  accounts: Account[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  recentTransactions: Transaction[];
}

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async (): Promise<UserDetailResponse> => {
      if (!userId) throw new Error("User ID is required");

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-user-detail", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { userId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch user details");
      }

      return response.data;
    },
    enabled: !!userId,
    staleTime: 30000,
  });
}

export type UserAction = 'suspend' | 'unsuspend' | 'delete' | 'promote' | 'demote' | 'resend_confirmation';

export function useAdminUserActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, action, data }: { userId: string; action: UserAction; data?: Record<string, unknown> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-user-actions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { userId, action, data },
      });

      if (response.error) {
        throw new Error(response.error.message || "Action failed");
      }

      return response.data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: data.message,
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
