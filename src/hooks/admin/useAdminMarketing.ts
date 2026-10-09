import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";
import type { MarketingOverview } from "../../../supabase/functions/_shared/marketingRules";

export type { MarketingOverview };

export function useMarketingOverview() {
  return useQuery({
    queryKey: ["admin", "marketing"],
    queryFn: async () => (await invokeAdmin<{ overview: MarketingOverview }>("admin-marketing")).overview,
    staleTime: 60_000,
  });
}
