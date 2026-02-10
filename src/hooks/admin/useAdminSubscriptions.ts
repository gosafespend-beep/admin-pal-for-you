import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  plan_type: string | null;
  trial_start: string;
  trial_end: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  userEmail: string;
}

interface SubscriptionStats {
  total: number;
  active: number;
  trialing: number;
  cancelled: number;
  expired: number;
}

interface SubscriptionResponse {
  subscriptions: Subscription[];
  total: number;
  stats: SubscriptionStats;
}

interface Filters {
  page: number;
  pageSize: number;
  status: string;
  search: string;
}

export function useAdminSubscriptions(filters: Filters) {
  return useQuery<SubscriptionResponse>({
    queryKey: ["admin", "subscriptions", filters],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
      });
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch subscriptions");
      }

      return res.json();
    },
  });
}

type SubscriptionAction = 'extend_trial' | 'cancel' | 'reactivate';

export function useSubscriptionAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, action, data }: { subscriptionId: string; action: SubscriptionAction; data?: Record<string, unknown> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ subscriptionId, action, data }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Action failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
