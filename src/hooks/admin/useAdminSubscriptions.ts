import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";
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

export interface EntitlementHealthCheck {
  check_name: string;
  severity: string;
  affected: number;
  detail: string;
}

export interface RevenueCatEntitlement {
  user_id: string;
  userEmail: string;
  entitlement: string;
  store: string | null;
  status: string;
  is_active: boolean;
  expires_at: string | null;
}

interface SubscriptionResponse {
  subscriptions: Subscription[];
  total: number;
  stats: SubscriptionStats;
  entitlementHealth: EntitlementHealthCheck[];
  entitlements: RevenueCatEntitlement[];
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
    queryFn: () =>
      invokeAdmin<SubscriptionResponse>("admin-subscriptions", {
        query: {
          page: filters.page,
          pageSize: filters.pageSize,
          status: filters.status,
          search: filters.search,
        },
      }),
    placeholderData: (previous) => previous,
  });
}

type SubscriptionAction = "extend_trial" | "cancel" | "reactivate";

export function useSubscriptionAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subscriptionId,
      action,
      data,
      reason,
    }: {
      subscriptionId: string;
      action: SubscriptionAction;
      data?: Record<string, unknown>;
      reason: string;
    }) =>
      invokeAdmin<{ message: string }>("admin-subscriptions", {
        method: "POST",
        body: { subscriptionId, action, data, reason },
      }),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
