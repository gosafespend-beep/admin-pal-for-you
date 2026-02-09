import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  theme: string;
  date_format: string;
  roles: string[];
  is_admin: boolean;
}

export interface AdminUsersFilters {
  search: string;
  role: string;
  verified: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    totalAdmins: number;
    totalVerified: number;
    totalSuspended: number;
  };
}

export function useAdminUsers(filters?: AdminUsersFilters) {
  const defaultFilters: AdminUsersFilters = {
    search: "",
    role: "",
    verified: "",
    page: 1,
    pageSize: 20,
    sortBy: "created_at",
    sortOrder: "desc",
  };
  const f = filters || defaultFilters;

  return useQuery({
    queryKey: ["admin", "users", f],
    queryFn: async (): Promise<AdminUsersResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        page: String(f.page),
        pageSize: String(f.pageSize),
        sortBy: f.sortBy,
        sortOrder: f.sortOrder,
      });
      if (f.search) params.set("search", f.search);
      if (f.role) params.set("role", f.role);
      if (f.verified) params.set("verified", f.verified);

      const response = await supabase.functions.invoke("admin-users?" + params.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch users");
      return response.data;
    },
    staleTime: 30000,
  });
}
