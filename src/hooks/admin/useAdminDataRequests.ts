import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invokeAdmin } from "@/lib/adminApi";

export type RequestType = "export" | "delete" | "rectify" | "opt_out" | "other";
export type RequestStatus = "received" | "in_progress" | "completed" | "rejected";

export interface DataRequest {
  id: string;
  request_type: RequestType;
  status: RequestStatus;
  requester_email: string;
  subject_user_id: string | null;
  channel: "email" | "in_app" | "other";
  received_at: string;
  due_at: string;
  identity_verified_at: string | null;
  verification_note: string | null;
  export_generated_at: string | null;
  completed_at: string | null;
  resolution: string | null;
  due: { tone: "ok" | "soon" | "overdue" | "closed"; days: number };
}

export interface DataRequestList {
  requests: DataRequest[];
  total: number;
  stats: { open: number; overdue: number; dueSoon: number; closedLast90Days: number };
}

export interface DataRequestDetail {
  request: DataRequest;
  subject: { exists: boolean; email?: string; createdAt?: string; lastSignInAt?: string | null } | null;
  deletionPreview: Array<{ table_name: string; action: string; rows_affected: number }>;
}

export interface HeldReport {
  retention: Array<{ table: string; rows: number; oldest: string | null }>;
  consent: {
    accounts: number; marketingOn: number; marketingOff: number; noPreferenceSaved: number;
    ebookLeads: number; waitlist: number;
  };
}

export interface UserDataExport {
  generatedAt: string;
  account: Record<string, unknown>;
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
  alsoHeld: { internalAdminNotes: number };
}

export function useDataRequests(status: string, type: string) {
  return useQuery({
    queryKey: ["admin", "data-requests", status, type],
    queryFn: () => invokeAdmin<DataRequestList>("admin-data-requests", { query: { status, type } }),
    placeholderData: (previous) => previous,
  });
}

export function useDataRequest(id: string | null) {
  return useQuery({
    queryKey: ["admin", "data-request", id],
    queryFn: () => invokeAdmin<DataRequestDetail>("admin-data-requests", { query: { id } }),
    enabled: !!id,
  });
}

export function useHeldReport(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "data-requests", "held"],
    queryFn: () => invokeAdmin<HeldReport>("admin-data-requests", { query: { view: "held" } }),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateDataRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: RequestType; requesterEmail: string; channel?: string; receivedAt?: string; dueDays?: number }) =>
      invokeAdmin<{ request: DataRequest; matchedAccount: boolean }>("admin-data-requests", { method: "POST", body }),
    onSuccess: (res) => {
      toast.success(res.matchedAccount ? "Request logged and matched to an account" : "Request logged (no matching account)");
      qc.invalidateQueries({ queryKey: ["admin", "data-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type RequestActionName = "verify" | "export" | "complete" | "reject";

export function useDataRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: RequestActionName; note?: string; resolution?: string }) =>
      invokeAdmin<{ request: DataRequest; export?: UserDataExport }>("admin-data-requests", {
        method: "PATCH",
        body: v,
      }),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "data-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "data-request", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
