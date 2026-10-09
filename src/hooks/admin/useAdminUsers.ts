import { useQuery } from "@tanstack/react-query";
import { invokeAdmin } from "@/lib/adminApi";

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
  platforms: string[];
  plan: "paid" | "trial" | "granted" | "free";
  stage: "signed_up" | "onboarded" | "activated" | "paying";
}

export interface AdminUsersFilters {
  search: string;
  role: string;
  verified: string;
  status: string;
  platform: string;
  plan: string;
  stage: string;
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
    totalUsers?: number;
    totalAdmins: number;
    totalVerified: number;
    totalSuspended: number;
    paying?: number;
    trialing?: number;
  };
}

export function useAdminUsers(filters?: AdminUsersFilters) {
  const defaultFilters: AdminUsersFilters = {
    search: "",
    role: "",
    verified: "",
    status: "",
    platform: "",
    plan: "",
    stage: "",
    page: 1,
    pageSize: 20,
    sortBy: "created_at",
    sortOrder: "desc",
  };
  const f = filters || defaultFilters;

  return useQuery({
    queryKey: ["admin", "users", f],
    queryFn: () =>
      invokeAdmin<AdminUsersResponse>("admin-users", {
        query: {
          page: f.page,
          pageSize: f.pageSize,
          sortBy: f.sortBy,
          sortOrder: f.sortOrder,
          search: f.search,
          role: f.role,
          verified: f.verified,
          status: f.status,
          platform: f.platform,
          plan: f.plan,
          stage: f.stage,
        },
      }),
    placeholderData: (previous) => previous,
    staleTime: 30000,
  });
}
