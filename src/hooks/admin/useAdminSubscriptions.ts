import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const token = session?.access_token;
      
      const params = new URLSearchParams({
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
      });
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(
        `https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/admin-subscriptions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlb2dxdmpxdmFmYnp1ZmFud2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTAwNDksImV4cCI6MjA4NTE4NjA0OX0.H84dCTVcdwBcmliqWDhfRK9cHMfAWSae1EfNj-oAyF8",
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
