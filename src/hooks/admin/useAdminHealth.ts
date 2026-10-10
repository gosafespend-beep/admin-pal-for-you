import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";
import type { Finding, HealthReport } from "../../../supabase/functions/_shared/healthRules";

export interface HealthResponse {
  report: HealthReport;
  findings: Finding[];
}

export function useSystemHealthReport() {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: () => invokeAdmin<HealthResponse>("admin-health"),
    staleTime: 30_000,
  });
}
