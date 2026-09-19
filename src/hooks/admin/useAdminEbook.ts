import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EbookTotals {
  requests: number;
  requests_in_window: number;
  unsubscribed: number;
  series_started: number;
  series_completed: number;
}

export interface EbookOpens {
  total: number;
  unique_emails: number;
  in_window: number;
}

export interface EbookSourceRow {
  source: string;
  requests: number;
}

export interface EbookStageRow {
  stage: number;
  leads: number;
}

export interface EbookDailyPoint {
  day: string;
  requests: number;
  opens: number;
}

export interface EbookStats {
  totals: EbookTotals;
  opens: EbookOpens;
  by_source: EbookSourceRow[];
  by_stage: EbookStageRow[];
  daily: EbookDailyPoint[];
}

export function useAdminEbook(days = 30) {
  return useQuery({
    queryKey: ["admin", "ebook", days],
    queryFn: async (): Promise<EbookStats> => {
      const { data, error } = await supabase.rpc("admin_ebook_stats" as never, {
        p_days: days,
      } as never);

      if (error) throw new Error(error.message || "Failed to fetch ebook stats");
      return data as unknown as EbookStats;
    },
    staleTime: 60000,
  });
}
