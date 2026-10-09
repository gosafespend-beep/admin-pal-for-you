import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";
import { toast } from "sonner";

export interface WaitlistFilters {
  search: string;
  status: string;
  page: number;
  pageSize: number;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface WaitlistResponse {
  data: WaitlistEntry[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
}

export function useAdminWaitlist(filters: WaitlistFilters) {
  return useQuery({
    queryKey: ["admin", "waitlist", filters],
    queryFn: () =>
      invokeAdmin<WaitlistResponse>("admin-waitlist", {
        query: { page: filters.page, pageSize: filters.pageSize, search: filters.search, status: filters.status },
      }),
    placeholderData: (previous) => previous,
    staleTime: 15000,
  });
}

export function useWaitlistActions() {
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      invokeAdmin("admin-waitlist", { method: "PATCH", body: { id, status } }),
    onSuccess: (_, vars) => {
      toast.success(`Entry ${vars.status} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => invokeAdmin("admin-waitlist", { method: "DELETE", body: { id } }),
    onSuccess: () => {
      toast.success("Entry deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { updateStatus, deleteEntry };
}
