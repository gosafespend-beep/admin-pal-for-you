import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";

export interface OpsAlert {
  fingerprint: string;
  source: string;
  severity: "problem" | "warning";
  title: string;
  detail: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  last_notified_at: string | null;
  notify_count: number;
  acknowledged_until: string | null;
  acknowledged_reason: string | null;
  resolved_at: string | null;
}

export interface AlertsResponse {
  active: OpsAlert[];
  fixed: OpsAlert[];
  emailTo: string;
  emailConfigured: boolean;
  checkEvery: string;
}

export function useOpsAlerts() {
  return useQuery({
    queryKey: ["admin", "alerts"],
    queryFn: () => invokeAdmin<AlertsResponse>("admin-alerts"),
    staleTime: 30_000,
  });
}

export function useAlertActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "alerts"] });
  const onError = (e: Error) => toast.error(e.message);

  return {
    check: useMutation({
      mutationFn: () => invokeAdmin<{ result: { found: number; resolved: number } }>("admin-alerts", { method: "POST", body: { action: "check" } }),
      onSuccess: (r) => {
        toast.success(r.result.found === 0 ? "Checked: nothing is wrong" : `Checked: ${r.result.found} open`);
        refresh();
      },
      onError,
    }),
    acknowledge: useMutation({
      mutationFn: (v: { fingerprint: string; days: number; reason: string }) =>
        invokeAdmin("admin-alerts", { method: "POST", body: { action: "acknowledge", ...v } }),
      onSuccess: () => { toast.success("Reminders paused"); refresh(); },
      onError,
    }),
    unacknowledge: useMutation({
      mutationFn: (fingerprint: string) => invokeAdmin("admin-alerts", { method: "POST", body: { action: "unacknowledge", fingerprint } }),
      onSuccess: () => { toast.success("Reminders back on"); refresh(); },
      onError,
    }),
  };
}
