import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

export interface GrowthMetrics {
  weeks: number;
  weekly: Array<{
    week: string; signups: number; setUp: number; tracked: number;
    onboarded: number; activated: number; paywall: number; paid: number;
  }>;
  funnel: {
    signedUp: number; setUp: number; tracked: number; onboarded: number;
    activated: number; sawPaywall: number; checkout: number; paid: number;
  };
  byPlatform: Array<{ platform: string; users: number; onboarded: number; activated: number; sawPaywall: number; paid: number }>;
  retention: Record<"d1" | "d7" | "d30", { eligible: number; retained: number }>;
  acquisition: Array<{ source: string; users: number; activated: number; paid: number }>;
  coverage: { users: number; withAcquisition: number; tracked: number; firstEvent: string | null };
  medianHoursToFirstTransaction: number | null;
  generatedAt: string;
}

export function useAdminGrowth(weeks: number) {
  return useQuery({
    queryKey: ["admin", "growth", weeks],
    queryFn: () => invokeAdmin<GrowthMetrics>("admin-metrics", { query: { weeks } }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}
