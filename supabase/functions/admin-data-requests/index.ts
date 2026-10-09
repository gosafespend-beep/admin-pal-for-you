import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { clampInt, errorResponse, HttpError, isUuid, json, requireAdmin, selectAll } from "../_shared/http.ts";
import { decideRequestAction, dueState, validateNewRequest, type RequestFacts, type RequestStatus, type RequestType } from "../_shared/dataRequestRules.ts";

/**
 * The data-request queue: people asking for a copy of their data, deletion,
 * correction, or to stop marketing.
 *
 *   GET                     the queue (filter by status/type) plus counts
 *   GET ?id=                one request, the matching account, and what a deletion would remove
 *   GET ?view=held          what we hold (row counts, oldest record) and marketing consent
 *   POST                    log a new request
 *   PATCH {id, action}      verify identity, generate the export, complete, or reject
 *
 * Every change is written to the audit log first (fail closed). Generating an
 * export of someone's personal data is an audited action in its own right and
 * the audit entry records counts, never the data.
 */
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const present = (row: Row) => ({
  ...row,
  due: dueState(row.due_at, row.status as RequestStatus),
});

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;
    const { adminClient } = ctx;
    const url = new URL(req.url);

    // ---- reads -------------------------------------------------------------
    if (req.method === "GET") {
      if (url.searchParams.get("view") === "held") {
        const [retention, consent] = await Promise.all([
          adminClient.rpc("admin_retention_report"),
          adminClient.rpc("admin_consent_summary"),
        ]);
        if (retention.error) throw retention.error;
        if (consent.error) throw consent.error;
        return json({ retention: retention.data, consent: consent.data }, 200, cors);
      }

      const id = url.searchParams.get("id");
      if (id) {
        if (!isUuid(id)) throw new HttpError(400, "A valid id is required");
        const { data: row } = await adminClient.from("data_requests").select("*").eq("id", id).maybeSingle();
        if (!row) throw new HttpError(404, "Request not found");

        let subject: Row | null = null;
        let deletionPreview: Row[] = [];
        if (row.subject_user_id) {
          const { data } = await adminClient.auth.admin.getUserById(row.subject_user_id);
          if (data?.user) {
            subject = { exists: true, email: data.user.email, createdAt: data.user.created_at, lastSignInAt: data.user.last_sign_in_at };
            if (row.status !== "completed" && row.status !== "rejected" && (row.request_type === "delete" || row.request_type === "export")) {
              // Counts only; nothing is changed.
              const preview = await adminClient.rpc("delete_user_data", { _uid: row.subject_user_id, _dry_run: true });
              if (!preview.error) deletionPreview = (preview.data ?? []).filter((p: Row) => Number(p.rows_affected) > 0);
            }
          } else {
            subject = { exists: false };
          }
        }
        return json({ request: present(row), subject, deletionPreview }, 200, cors);
      }

      const status = url.searchParams.get("status") || "open";
      const type = url.searchParams.get("type") || "";
      const all = await selectAll(adminClient, "data_requests", "*");
      all.sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));

      const isOpen = (r: Row) => r.status === "received" || r.status === "in_progress";
      let rows = all;
      if (status === "open") rows = rows.filter(isOpen);
      else if (status === "closed") rows = rows.filter((r) => !isOpen(r));
      else if (status !== "all") rows = rows.filter((r) => r.status === status);
      if (type) rows = rows.filter((r) => r.request_type === type);
      if (status === "closed") rows = [...rows].reverse();

      const open = all.filter(isOpen);
      const states = open.map((r) => dueState(r.due_at, r.status));
      const pageSize = clampInt(url.searchParams.get("pageSize"), 25, 1, 100);
      const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);

      return json(
        {
          requests: rows.slice((page - 1) * pageSize, page * pageSize).map(present),
          total: rows.length,
          stats: {
            open: open.length,
            overdue: states.filter((s) => s.tone === "overdue").length,
            dueSoon: states.filter((s) => s.tone === "soon").length,
            closedLast90Days: all.filter((r) => !isOpen(r) && r.completed_at && Date.now() - new Date(r.completed_at).getTime() < 90 * 86_400_000).length,
          },
          page,
          pageSize,
        },
        200,
        cors,
      );
    }

    // ---- log a new request ---------------------------------------------------
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const parsed = validateNewRequest(body);
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const v = parsed.value;

      const { data: subjectId } = await adminClient.rpc("admin_find_user_by_email", { p_email: v.email });
      const newId = crypto.randomUUID();

      const created = await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: "dsar_create",
          targetType: "data_request",
          targetId: newId,
          details: { type: v.type, requester_email: v.email, channel: v.channel, matched_account: Boolean(subjectId), due_at: v.dueAt.toISOString() },
          meta: ctx.meta,
        },
        async () => {
          const { data, error } = await adminClient
            .from("data_requests")
            .insert({
              id: newId,
              request_type: v.type,
              requester_email: v.email,
              subject_user_id: subjectId ?? null,
              channel: v.channel,
              received_at: v.receivedAt.toISOString(),
              due_at: v.dueAt.toISOString(),
              created_by: ctx.adminId,
            })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
      );
      return json({ request: present(created), matchedAccount: Boolean(subjectId) }, 201, cors);
    }

    // ---- act on a request ------------------------------------------------------
    if (req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      if (!isUuid(body.id)) throw new HttpError(400, "A valid id is required");
      const { data: row } = await adminClient.from("data_requests").select("*").eq("id", body.id).maybeSingle();
      if (!row) throw new HttpError(404, "Request not found");

      let subjectStillExists = false;
      if (row.subject_user_id) {
        const { data } = await adminClient.auth.admin.getUserById(row.subject_user_id);
        subjectStillExists = Boolean(data?.user);
      }
      const facts: RequestFacts = {
        type: row.request_type as RequestType,
        status: row.status as RequestStatus,
        identityVerifiedAt: row.identity_verified_at,
        exportGeneratedAt: row.export_generated_at,
        hasSubject: Boolean(row.subject_user_id),
        subjectStillExists,
      };
      const decision = decideRequestAction(body.action, facts, { note: body.note, resolution: body.resolution });
      if (!decision.ok) throw new HttpError(decision.status, decision.error);

      const now = new Date().toISOString();
      const entry = {
        adminUserId: ctx.adminId,
        action: `dsar_${body.action}`,
        targetType: "data_request",
        targetId: row.id,
        details: { type: row.request_type, requester_email: row.requester_email, note: decision.text || undefined },
        meta: ctx.meta,
      };
      const update = async (fields: Row) => {
        const { data, error } = await adminClient
          .from("data_requests")
          .update({ ...fields, handled_by: ctx.adminId, updated_at: now })
          .eq("id", row.id)
          .select()
          .single();
        if (error) throw error;
        return data as Row;
      };

      if (body.action === "verify") {
        const updated = await audited(adminClient, entry, () =>
          update({ identity_verified_at: now, verified_by: ctx.adminId, verification_note: decision.text, status: "in_progress" }));
        return json({ request: present(updated) }, 200, cors);
      }

      if (body.action === "export") {
        const result = await audited(
          adminClient,
          entry,
          async () => {
            const { data, error } = await adminClient.rpc("admin_export_user_data", { p_user: row.subject_user_id });
            if (error) throw error;
            return { export: data, request: await update({ export_generated_at: now, status: "in_progress" }) };
          },
          (r) => ({ rows_exported: Object.values(r.export?.counts ?? {}).reduce((a: number, b) => a + Number(b), 0), tables: Object.keys(r.export?.counts ?? {}).length }),
        );
        return json({ request: present(result.request), export: result.export }, 200, cors);
      }

      if (body.action === "complete") {
        const resolution =
          decision.text ||
          (row.request_type === "export" ? "Copy of the person's data was generated and sent." : "Account and data deleted.");
        const updated = await audited(adminClient, entry, () =>
          update({ status: "completed", completed_at: now, resolution }));
        return json({ request: present(updated) }, 200, cors);
      }

      // reject
      const updated = await audited(adminClient, entry, () =>
        update({ status: "rejected", completed_at: now, resolution: decision.text }));
      return json({ request: present(updated) }, 200, cors);
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-data-requests");
  }
});
