import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  id: string;
  admin_user_id: string;
  adminEmail: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogFilters {
  page: number;
  pageSize: number;
  action: string;
  targetType: string;
}

export function useAdminAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["admin", "audit-log", filters],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.action) params.set("action", filters.action);
      if (filters.targetType) params.set("targetType", filters.targetType);

      const response = await supabase.functions.invoke("admin-audit-log?" + params.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch audit log");
      return response.data as { data: AuditLogEntry[]; total: number; page: number; pageSize: number };
    },
    staleTime: 15000,
  });
}
