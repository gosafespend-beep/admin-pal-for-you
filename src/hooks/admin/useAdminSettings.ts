import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

interface HealthCheck {
  status: string;
  latency?: number;
  details?: string;
}

interface HealthData {
  checks: Record<string, HealthCheck>;
  timestamp: string;
}

interface AdminUser {
  userId: string;
  email: string;
  createdAt: string;
  roleAssignedAt: string;
}

export interface BlogImageSettings {
  defaultFeaturedImage: string;
}

function invokeSettings(action: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return invokeAdmin<any>("admin-settings", { method, query: { action }, body });
}

export function useSystemHealth() {
  return useQuery<HealthData>({
    queryKey: ["admin", "health"],
    queryFn: () => invokeSettings("health"),
    refetchInterval: 60000,
  });
}

export function useAdminList() {
  return useQuery<{ admins: AdminUser[] }>({
    queryKey: ["admin", "admins"],
    queryFn: () => invokeSettings("admins"),
  });
}

export function useAddAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; reason: string }) => invokeSettings("add-admin", "POST", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] }),
  });
}

export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; reason: string }) => invokeSettings("remove-admin", "POST", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] }),
  });
}

export function useBlogImageSettings() {
  return useQuery<BlogImageSettings>({
    queryKey: ["admin", "settings", "blog-images"],
    queryFn: async () => {
      const response = await invokeSettings("blog-images");
      return { defaultFeaturedImage: response.defaultFeaturedImage || "" };
    },
    staleTime: 60000,
  });
}

export function useUpdateBlogImageSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaultFeaturedImage: string) =>
      invokeSettings("blog-images", "POST", { defaultFeaturedImage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "settings", "blog-images"] });
    },
  });
}
