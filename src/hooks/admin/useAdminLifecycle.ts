import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";
import type { Audience, Mode, TemplateKey } from "../../../supabase/functions/_shared/lifecycleRules";

export interface LifecycleTemplate {
  key: TemplateKey;
  subject: string;
  body: string;
  audience: Audience;
  enabled: boolean;
  liveSince: string | null;
  updatedAt: string;
  eligibleNow: number;
  sent7d: number;
  sentTotal: number;
  failed7d: number;
}

export interface LifecycleOverview {
  settings: { mode: Mode; daily_cap: number; min_gap_hours: number; app_url: string };
  sentToday: number;
  templates: LifecycleTemplate[];
  recent: Array<{ template: TemplateKey; status: "sent" | "failed"; error: string; at: string; email: string }>;
  emailConfigured: boolean;
}

export function useLifecycle() {
  return useQuery({
    queryKey: ["admin", "lifecycle"],
    queryFn: async () => (await invokeAdmin<{ overview: LifecycleOverview }>("admin-lifecycle")).overview,
    staleTime: 30_000,
  });
}

export function useLifecycleActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "lifecycle"] });
  const onError = (e: Error) => toast.error(e.message);
  const post = <T,>(body: Record<string, unknown>) => invokeAdmin<T>("admin-lifecycle", { method: "POST", body });

  return {
    updateTemplate: useMutation({
      mutationFn: (v: { key: TemplateKey; subject?: string; body?: string; audience?: Audience; enabled?: boolean; reason?: string; confirmService?: boolean }) =>
        post({ action: "update_template", ...v }),
      onSuccess: () => { toast.success("Saved"); refresh(); },
      onError,
    }),
    updateSettings: useMutation({
      mutationFn: (v: { mode?: Mode; daily_cap?: number; min_gap_hours?: number; reason: string }) => post({ action: "update_settings", ...v }),
      onSuccess: () => { toast.success("Saved"); refresh(); },
      onError,
    }),
    preview: useMutation({
      mutationFn: (key: TemplateKey) => post<{ subject: string; html: string }>({ action: "preview", key }),
      onError,
    }),
    test: useMutation({
      mutationFn: (key: TemplateKey) => post<{ success: true; sentTo: string }>({ action: "test", key }),
      onSuccess: (r) => toast.success(`Test sent to ${r.sentTo}`),
      onError,
    }),
  };
}
