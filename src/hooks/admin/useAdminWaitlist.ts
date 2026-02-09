import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  statusCounts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

export function useAdminWaitlist(filters: WaitlistFilters) {
  return useQuery({
    queryKey: ["admin", "waitlist", filters],
    queryFn: async (): Promise<WaitlistResponse> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);

      const response = await supabase.functions.invoke("admin-waitlist?" + params.toString(), {
        method: "GET",
        headers,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 15000,
  });
}

export function useWaitlistActions() {
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-waitlist", {
        method: "PATCH",
        headers,
        body: { id, status },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Entry ${vars.status} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-waitlist", {
        method: "DELETE",
        headers,
        body: { id },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { updateStatus, deleteEntry };
}
