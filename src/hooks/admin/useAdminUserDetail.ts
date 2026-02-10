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

export interface ActivitySummary {
  totalExpenses: number;
  totalIncomes: number;
  totalTransfers: number;
  totalTransactions: number;
  lastActiveAt: string | null;
  accountAge: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category?: string;
  note?: string;
  source?: string;
  type: 'expense' | 'income';
}

export interface Subscription {
  id: string;
  status: string;
  plan_type: string | null;
  trial_start: string;
  trial_end: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
}

export interface UserSession {
  session_id: string;
  created_at: string;
  updated_at: string;
  user_agent: string;
  ip: string;
}

export interface UserDetailResponse {
  user: UserDetail;
  activitySummary: ActivitySummary;
  recentTransactions: Transaction[];
  subscription: Subscription | null;
  sessions: UserSession[];
}

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async (): Promise<UserDetailResponse> => {
      if (!userId) throw new Error("User ID is required");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-user-detail", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch user details");
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
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-user-actions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId, action, data },
      });

      if (response.error) throw new Error(response.error.message || "Action failed");
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, sessionId }: { userId: string; sessionId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('revoke_user_session', {
        p_user_id: userId,
        p_session_id: sessionId,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      toast({ title: "Session Revoked", description: "The session has been terminated." });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
