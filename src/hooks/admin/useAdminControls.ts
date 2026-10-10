import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";
import type { Control, Flag, Platform, StorePlatform } from "../../../supabase/functions/_shared/controlRules";

export interface ControlsResponse {
  control: Control;
  flags: Flag[];
  versionsInUse: Array<{ platform: string; version: string; users: number; events: number }>;
}

export function useControls() {
  return useQuery({
    queryKey: ["admin", "controls"],
    queryFn: () => invokeAdmin<ControlsResponse>("admin-controls"),
    staleTime: 30_000,
  });
}

export function useControlActions() {
  const qc = useQueryClient();
  const onSuccess = () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "controls"] }); };
  const onError = (e: Error) => toast.error(e.message);
  const post = (body: Record<string, unknown>) => invokeAdmin("admin-controls", { method: "POST", body });

  return {
    banner: useMutation({
      mutationFn: (v: { active: boolean; kind: string; severity: string; message: string; startsAt: string | null; endsAt: string | null; reason: string; confirm?: boolean }) =>
        post({ action: "update_banner", ...v }),
      onSuccess, onError,
    }),
    versions: useMutation({
      mutationFn: (v: { platform: StorePlatform; latest: string; min: string; storeUrl: string; reason: string; confirm?: boolean }) =>
        post({ action: "update_versions", ...v }),
      onSuccess, onError,
    }),
    flag: useMutation({
      mutationFn: (v: { key: string; description: string; enabled: boolean; rolloutPct: number; platforms: Platform[]; public: boolean; reason: string }) =>
        post({ action: "upsert_flag", ...v }),
      onSuccess, onError,
    }),
    deleteFlag: useMutation({
      mutationFn: (v: { key: string; reason: string }) => post({ action: "delete_flag", ...v }),
      onSuccess, onError,
    }),
  };
}
