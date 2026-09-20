import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

async function invokeSettings(action: string, method = "GET", body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  const url = `https://qeogqvjqvafbzufanwki.supabase.co/functions/v1/admin-settings?action=${action}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlb2dxdmpxdmFmYnp1ZmFud2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTAwNDksImV4cCI6MjA4NTE4NjA0OX0.H84dCTVcdwBcmliqWDhfRK9cHMfAWSae1EfNj-oAyF8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
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
    mutationFn: (email: string) => invokeSettings("add-admin", "POST", { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "admins"] }),
  });
}

export function useRemoveAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => invokeSettings("remove-admin", "POST", { userId }),
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
