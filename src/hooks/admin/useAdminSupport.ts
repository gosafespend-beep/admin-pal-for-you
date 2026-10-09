import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";
import type { WriteSnapshot } from "@/lib/supportDiagnosis";

export interface SupportMatch {
  id: string;
  email: string;
  display_name: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  plan: "paid" | "trial" | "granted" | "free";
  stage: "signed_up" | "onboarded" | "activated" | "paying";
  platforms: string[];
}

export interface SupportMacro {
  id: string;
  title: string;
  category: "account" | "billing" | "privacy" | "how_to" | "other";
  subject: string;
  body: string;
  active: boolean;
}

export type MacroDraft = Pick<SupportMacro, "title" | "category" | "subject" | "body"> & { active?: boolean };

/** Runs only once a search has been submitted, so typing doesn't fire a request per keystroke. */
export function useSupportLookup(q: string) {
  return useQuery({
    queryKey: ["admin", "support", "lookup", q],
    queryFn: () => invokeAdmin<{ users: SupportMatch[]; total: number }>("admin-support", { query: { q } }),
    enabled: q.trim().length >= 3,
    staleTime: 30_000,
  });
}

export function useWriteSnapshot(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "support", "snapshot", userId],
    queryFn: async () => (await invokeAdmin<{ snapshot: WriteSnapshot }>("admin-support", { query: { snapshot: userId } })).snapshot,
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useSupportMacros(includeInactive = false) {
  return useQuery({
    queryKey: ["admin", "support", "macros", includeInactive],
    queryFn: async () =>
      (await invokeAdmin<{ macros: SupportMacro[] }>("admin-support", { query: { view: "macros", all: includeInactive ? 1 : undefined } })).macros,
    staleTime: 60_000,
  });
}

export function useMacroMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "support", "macros"] });
  const onError = (e: Error) => toast.error(e.message);

  return {
    create: useMutation({
      mutationFn: (body: MacroDraft) => invokeAdmin<{ macro: SupportMacro }>("admin-support", { method: "POST", body }),
      onSuccess: () => { toast.success("Reply saved"); refresh(); },
      onError,
    }),
    update: useMutation({
      mutationFn: (body: Partial<MacroDraft> & { id: string }) => invokeAdmin<{ macro: SupportMacro }>("admin-support", { method: "PATCH", body }),
      onSuccess: () => { toast.success("Reply updated"); refresh(); },
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => invokeAdmin<{ success: true }>("admin-support", { method: "DELETE", body: { id } }),
      onSuccess: () => { toast.success("Reply deleted"); refresh(); },
      onError,
    }),
  };
}
