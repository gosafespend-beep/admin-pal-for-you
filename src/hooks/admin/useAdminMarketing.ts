import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";
import type { MarketingOverview } from "../../../supabase/functions/_shared/marketingRules";
import type { ControlRequest } from "../../../supabase/functions/_shared/marketingControlRules";

export type { MarketingOverview };

export function useMarketingOverview() {
  return useQuery({
    queryKey: ["admin", "marketing"],
    queryFn: async () => (await invokeAdmin<{ overview: MarketingOverview }>("admin-marketing")).overview,
    staleTime: 60_000,
  });
}

/** Pause or resume one agent, one channel, or everything. The server audits it first and refuses a wrong move with a plain sentence. */
export function useMarketingControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ControlRequest) =>
      invokeAdmin<{ success: true; result: Record<string, unknown> }>("admin-marketing", { method: "POST", body }),
    onSuccess: (_res, v) => {
      toast.success(v.action === "pause" ? "Paused" : "Resumed");
      qc.invalidateQueries({ queryKey: ["admin", "marketing"] });
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
