import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

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
    queryFn: () =>
      invokeAdmin<TransactionsResponse>("admin-transactions", {
        query: {
          type: filters.type,
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          startDate: filters.startDate,
          endDate: filters.endDate,
          userId: filters.userId,
        },
      }),
    placeholderData: (previous) => previous,
    staleTime: 15000,
  });
}
