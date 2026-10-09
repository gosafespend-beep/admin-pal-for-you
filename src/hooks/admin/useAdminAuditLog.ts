import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

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
    queryFn: () =>
      invokeAdmin<{
        data: AuditLogEntry[];
        total: number;
        page: number;
        pageSize: number;
        facets: { actions: string[]; targetTypes: string[] };
      }>("admin-audit-log", {
        query: {
          page: filters.page,
          pageSize: filters.pageSize,
          action: filters.action,
          targetType: filters.targetType,
        },
      }),
    placeholderData: (previous) => previous,
    staleTime: 15000,
  });
}
