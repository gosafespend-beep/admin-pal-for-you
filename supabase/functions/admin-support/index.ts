import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { errorResponse, HttpError, isUuid, json, requireAdmin } from "../_shared/http.ts";
import { classifyQuery, validateMacro } from "../_shared/supportRules.ts";

/**
 * Support tools.
 *
 *   GET ?q=                 find a person by email, name, account id, or Paystack customer/subscription code
 *   GET ?snapshot=<userId>  whether the app lets them save data right now, and why
 *   GET ?view=macros        saved replies (add &all=1 to include switched-off ones)
 *   POST / PATCH / DELETE   create, edit, or remove a saved reply
 *
 * Nothing here shows a person's financial data; opening their page goes through
 * admin-user-detail, which audits the view. Editing saved replies is audited.
 */
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

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
      const snapshotFor = url.searchParams.get("snapshot");
      if (snapshotFor) {
        if (!isUuid(snapshotFor)) throw new HttpError(400, "A valid user id is required");
        const { data, error } = await adminClient.rpc("admin_support_snapshot", { p_user: snapshotFor });
        if (error) throw error;
        return json({ snapshot: data }, 200, cors);
      }

      if (url.searchParams.get("view") === "macros") {
        let query = adminClient.from("support_macros").select("*").order("category").order("title");
        if (url.searchParams.get("all") !== "1") query = query.eq("active", true);
        const { data, error } = await query;
        if (error) throw error;
        return json({ macros: data ?? [] }, 200, cors);
      }

      const { kind, q } = classifyQuery(url.searchParams.get("q"));
      if (kind === "too_short") throw new HttpError(400, "Type at least 3 characters");

      const list = (search: string) => adminClient.rpc("admin_list_users", { p_search: search, p_limit: 10, p_offset: 0 });

      if (kind === "text") {
        const { data, error } = await list(q);
        if (error) throw error;
        return json({ users: data?.users ?? [], total: data?.total ?? 0 }, 200, cors);
      }

      // An account id or a Paystack code points at exactly one person. Resolve
      // it to their email and reuse the same listing so the row has the same
      // plan and stage as everywhere else.
      let ids: string[] = [];
      if (kind === "uuid") {
        ids = [q];
      } else {
        const { data, error } = await adminClient
          .from("subscriptions")
          .select("user_id")
          .or(`paystack_customer_code.eq.${q},paystack_subscription_code.eq.${q}`);
        if (error) throw error;
        ids = (data ?? []).map((r: Row) => r.user_id);
      }

      const users: Row[] = [];
      for (const id of [...new Set(ids)].slice(0, 5)) {
        const { data } = await adminClient.auth.admin.getUserById(id);
        if (!data?.user?.email) continue;
        const { data: found, error } = await list(data.user.email);
        if (error) throw error;
        const match = (found?.users ?? []).find((u: Row) => u.id === id);
        if (match) users.push(match);
      }
      return json({ users, total: users.length }, 200, cors);
    }

    // ---- saved replies -------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const entry = (action: string, targetId: string, details: Row) => ({
      adminUserId: ctx.adminId,
      action,
      targetType: "support_macro",
      targetId,
      details,
      meta: ctx.meta,
    });

    if (req.method === "POST") {
      const parsed = validateMacro(body);
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const id = crypto.randomUUID();
      const created = await audited(
        adminClient,
        entry("support_macro_create", id, { title: parsed.value.title, category: parsed.value.category }),
        async () => {
          const { data, error } = await adminClient
            .from("support_macros")
            .insert({ id, ...parsed.value, created_by: ctx.adminId, updated_by: ctx.adminId })
            .select()
            .single();
          if (error) throw error;
          return data;
        },
      );
      return json({ macro: created }, 201, cors);
    }

    if (req.method === "PATCH") {
      if (!isUuid(body.id)) throw new HttpError(400, "A valid id is required");
      const parsed = validateMacro(body, true);
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      if (Object.keys(parsed.value).length === 0) throw new HttpError(400, "Nothing to change");
      const updated = await audited(
        adminClient,
        entry("support_macro_update", body.id, { fields: Object.keys(parsed.value) }),
        async () => {
          const { data, error } = await adminClient
            .from("support_macros")
            .update({ ...parsed.value, updated_by: ctx.adminId, updated_at: new Date().toISOString() })
            .eq("id", body.id)
            .select()
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new HttpError(404, "Reply not found");
          return data;
        },
      );
      return json({ macro: updated }, 200, cors);
    }

    if (req.method === "DELETE") {
      if (!isUuid(body.id)) throw new HttpError(400, "A valid id is required");
      const { data: existing } = await adminClient.from("support_macros").select("title").eq("id", body.id).maybeSingle();
      if (!existing) throw new HttpError(404, "Reply not found");
      await audited(adminClient, entry("support_macro_delete", body.id, { title: existing.title }), async () => {
        const { error } = await adminClient.from("support_macros").delete().eq("id", body.id);
        if (error) throw error;
      });
      return json({ success: true }, 200, cors);
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-support");
  }
});
