import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

export interface BillingPerson {
  userId: string;
  email: string | null;
}

export interface BillingOverview {
  currency: string;
  /** Always true today: figures are list-price estimates, not settled revenue. */
  estimate: boolean;
  mrr: { paystack: number; store: number; total: number };
  arr: number;
  customers: {
    paystack: number;
    store: number;
    granted: number;
    liveTrials: number;
    staleTrials: number;
    sandboxIgnored: number;
  };
  last30d: { trialsStarted: number; cancellations: number; storeExpirations: number };
  trialToPaid: { trialsEnded: number; converted: number };
  trialsEndingSoon: Array<BillingPerson & { source: "web" | "store"; endsAt: string }>;
  attention: {
    staleTrials: { count: number; sample: Array<BillingPerson & { trialEnd: string }> };
    paidWithoutPeriodEnd: { count: number; sample: BillingPerson[] };
  };
  health: Array<{ check_name: string; severity: string; affected: number; detail: string }>;
  generatedAt: string;
}

export function useAdminBilling() {
  return useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => invokeAdmin<BillingOverview>("admin-billing"),
    staleTime: 60_000,
  });
}
