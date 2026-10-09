import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";
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

export interface UserOverview {
  acquisition: {
    source: string | null; medium: string | null; campaign: string | null; content: string | null;
    referrer: string | null; landingPath: string | null; country: string | null;
    acquiredAt: string | null; writeAccessUntil: string | null;
  } | null;
  platforms: Array<{ platform: string; events: number; firstSeen: string; lastSeen: string }>;
  milestones: {
    signup: string | null; onboardingComplete: string | null; firstTransaction: string | null;
    paywallView: string | null; checkoutStart: string | null; purchaseSuccess: string | null;
    lastEvent: string | null; events: number;
  };
  timeline: Array<{ event: string; platform: string | null; at: string }>;
  accounts: Array<{ type: string; currency: string; active: boolean }>;
  counts: {
    expenses: number; incomes: number; transfers: number; accounts: number; budgets: number;
    goals: number; bills: number; debts: number; recurring: number;
  };
  lastTransactionAt: string | null;
  entitlements: Array<{
    entitlement: string; product_id: string; status: string; is_active: boolean; period_type: string | null;
    store: string; environment: string | null; purchased_at: string | null; expires_at: string | null;
  }>;
  notifications: { billReminders: boolean; budgetAlerts: boolean; marketingEmails: boolean; weeklySummary: boolean } | null;
}

export interface RevealedTransaction {
  id: string; type: "expense" | "income"; date: string; amount: number; currency: string;
  category?: string | null; source?: string | null; note?: string | null;
}

export interface UserDetailResponse {
  overview: UserOverview;
  transactionsMasked: boolean;
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
      return invokeAdmin<UserDetailResponse>("admin-user-detail", { method: "POST", body: { userId } });
    },
    enabled: !!userId,
    staleTime: 30000,
  });
}

export type UserAction = 'suspend' | 'unsuspend' | 'delete' | 'promote' | 'demote' | 'resend_confirmation';

/** Shows a person's recent transactions. Needs a written reason, which is audited. */
export function useRevealTransactions() {
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      invokeAdmin<{ message: string; data: RevealedTransaction[] }>("admin-user-actions", {
        method: "POST",
        body: { userId, action: "reveal_transactions", reason },
      }),
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useAdminUserActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      action,
      data,
      reason,
    }: {
      userId: string;
      action: UserAction;
      data?: Record<string, unknown>;
      reason?: string;
    }) =>
      invokeAdmin<{ message: string }>("admin-user-actions", {
        method: "POST",
        body: { userId, action, data, reason },
      }),
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
    // Goes through admin-user-actions so the revoke is audited like every other action.
    mutationFn: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
      invokeAdmin<{ message: string }>("admin-user-actions", {
        method: "POST",
        body: { userId, action: "revoke_session", data: { sessionId } },
      }),
    onSuccess: (_, variables) => {
      toast({ title: "Session Revoked", description: "The session has been terminated." });
      queryClient.invalidateQueries({ queryKey: ["admin", "user", variables.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
