import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UserNote {
  id: string;
  user_id: string;
  admin_id: string;
  adminEmail: string;
  note: string;
  tag: string | null;
  created_at: string;
}

export function useAdminUserNotes(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user-notes", userId],
    queryFn: async () => {
      if (!userId) throw new Error("userId required");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-user-notes?userId=" + userId, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message || "Failed to fetch notes");
      return response.data.data as UserNote[];
    },
    enabled: !!userId,
    staleTime: 15000,
  });
}

export function useAddUserNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, note, tag }: { userId: string; note: string; tag?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-user-notes", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId, note, tag },
      });

      if (response.error) throw new Error(response.error.message || "Failed to add note");
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-notes", variables.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteUserNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, userId }: { noteId: string; userId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("admin-user-notes", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { noteId },
      });

      if (response.error) throw new Error(response.error.message || "Failed to delete note");
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast({ title: "Note deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "user-notes", variables.userId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
