import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionFilters {
  type: "all" | "expenses" | "incomes" | "transfers";
  search: string;
  startDate: string;
  endDate: string;
  userId: string;
  page: number;
  pageSize: number;
}

interface TransactionSet {
  data: Array<Record<string, unknown>>;
  total: number;
}

export interface TransactionsResponse {
  page: number;
  pageSize: number;
  expenses?: TransactionSet;
  incomes?: TransactionSet;
  transfers?: TransactionSet;
}

export function useAdminTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["admin", "transactions", filters],
    queryFn: async (): Promise<TransactionsResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        type: filters.type,
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.userId) params.set("userId", filters.userId);

      const response = await supabase.functions.invoke("admin-transactions?" + params.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch transactions");
      return response.data;
    },
    staleTime: 15000,
  });
}
