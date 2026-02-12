import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export interface BlogFilters {
  search: string;
  status: string;
  category: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  author_name: string;
  category: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  reading_time_minutes: number;
  scheduled_publish_at: string | null;
  canonical_url: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  og_image: string | null;
  is_featured: boolean;
  faq_schema_enabled: boolean;
  article_schema_enabled: boolean;
  cta_headline: string | null;
  cta_description: string | null;
  cta_button_text: string | null;
  cta_url: string | null;
  created_at: string;
  updated_at: string;
}

interface BlogListResponse {
  data: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: { total: number; published: number; draft: number };
  categories: string[];
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

export function useAdminBlogList(filters: BlogFilters) {
  return useQuery({
    queryKey: ["admin", "blog", filters],
    queryFn: async (): Promise<BlogListResponse> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        page: String(filters.page),
        pageSize: String(filters.pageSize),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      const response = await supabase.functions.invoke("admin-blog?" + params.toString(), {
        method: "GET",
        headers,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    staleTime: 15000,
  });
}

export function useAdminBlogPost(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "blog", "post", id],
    queryFn: async (): Promise<BlogPost> => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog?id=" + id, {
        method: "GET",
        headers,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useSlugCheck(slug: string, excludeId?: string) {
  const [debouncedSlug, setDebouncedSlug] = useState(slug);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSlug(slug), 500);
    return () => clearTimeout(timer);
  }, [slug]);

  return useQuery({
    queryKey: ["admin", "blog", "slugCheck", debouncedSlug, excludeId],
    queryFn: async (): Promise<boolean> => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ checkSlug: debouncedSlug });
      if (excludeId) params.set("excludeId", excludeId);
      const response = await supabase.functions.invoke("admin-blog?" + params.toString(), {
        method: "GET",
        headers,
      });
      if (response.error) throw new Error(response.error.message);
      return response.data.available;
    },
    enabled: !!debouncedSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(debouncedSlug),
    staleTime: 10000,
  });
}

export function useBlogActions() {
  const queryClient = useQueryClient();

  const createPost = useMutation({
    mutationFn: async (post: Partial<BlogPost>) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "POST",
        headers,
        body: post,
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.data as BlogPost;
    },
    onSuccess: (data) => {
      toast.success(`Article "${data.title}" created`);
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePost = useMutation({
    mutationFn: async (post: Partial<BlogPost> & { id: string }) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "PUT",
        headers,
        body: post,
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data.data as BlogPost;
    },
    onSuccess: (data) => {
      toast.success(`Article "${data.title}" updated`);
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "DELETE",
        headers,
        body: { id },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Article deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "PUT",
        headers,
        body: { id, is_published },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data.data as BlogPost;
    },
    onSuccess: (data) => {
      toast.success(data.is_published ? "Article published" : "Article unpublished");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<BlogPost> }) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "PUT",
        headers,
        body: { ids, updates },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Bulk update complete");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const headers = await getAuthHeaders();
      const response = await supabase.functions.invoke("admin-blog", {
        method: "DELETE",
        headers,
        body: { ids },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Articles deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { createPost, updatePost, deletePost, togglePublish, bulkUpdate, bulkDelete };
}
