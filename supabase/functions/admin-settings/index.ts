import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { emailsFor, errorResponse, HttpError, isUuid, json, listAllUsers, requireAdmin } from "../_shared/http.ts";
import { decideUserAction } from "../_shared/userActionRules.ts";

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
    const action = url.searchParams.get("action") || "health";

    if (req.method === "GET" && action === "health") {
      // Only checks that really run. (An "edge functions healthy, 0 ms" check
      // used to be hard-coded; if this function answers, functions work, so it
      // adds no information and is no longer reported.)
      const checks: Record<string, { status: string; latency?: number; details?: string }> = {};
      const time = async (name: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
        const start = Date.now();
        const { error } = await fn();
        if (error) console.error(`[admin-settings] ${requestId} health ${name}`, error.message);
        checks[name] = { status: error ? "error" : "healthy", latency: Date.now() - start, details: error ? "Check failed" : undefined };
      };
      await Promise.all([
        time("database", () => adminClient.from("profiles").select("id", { count: "exact", head: true })),
        time("authentication", () => adminClient.auth.admin.listUsers({ perPage: 1 })),
        time("storage", () => adminClient.storage.listBuckets()),
      ]);
      return json({ checks, timestamp: new Date().toISOString() }, 200, cors);
    }

    if (req.method === "GET" && action === "admins") {
      const { data: roles, error } = await adminClient.from("user_roles").select("user_id, role, created_at").eq("role", "admin");
      if (error) throw error;
      const ids = (roles || []).map((r) => r.user_id);
      const emails = await emailsFor(adminClient, ids);
      const created = new Map<string, string | undefined>();
      await Promise.all(
        ids.map(async (id) => {
          const { data } = await adminClient.auth.admin.getUserById(id);
          created.set(id, data?.user?.created_at);
        }),
      );
      const admins = (roles || []).map((r) => ({
        userId: r.user_id,
        email: emails.get(r.user_id) || "Unknown",
        createdAt: created.get(r.user_id),
        roleAssignedAt: r.created_at,
      }));
      return json({ admins }, 200, cors);
    }

    if (req.method === "GET" && action === "blog-images") {
      const { data, error } = await adminClient.from("app_settings").select("value").eq("key", "blog_default_featured_image").maybeSingle();
      if (error) throw error;
      return json({ defaultFeaturedImage: typeof data?.value === "string" ? data.value : "" }, 200, cors);
    }

    if (req.method === "POST" && action === "blog-images") {
      const { defaultFeaturedImage } = await req.json().catch(() => ({}));
      if (typeof defaultFeaturedImage !== "string" || !/^https:\/\/.+/.test(defaultFeaturedImage) || defaultFeaturedImage.length > 2048) {
        throw new HttpError(400, "A valid HTTPS image URL is required");
      }
      await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: "blog_default_image_update",
          targetType: "app_setting",
          targetId: "blog_default_featured_image",
          details: { defaultFeaturedImage },
          meta: ctx.meta,
        },
        async () => {
          const { error } = await adminClient
            .from("app_settings")
            .upsert({ key: "blog_default_featured_image", value: defaultFeaturedImage, updated_at: new Date().toISOString() }, { onConflict: "key" });
          if (error) throw error;
        },
      );
      return json({ success: true, defaultFeaturedImage }, 200, cors);
    }

    if (req.method === "POST" && (action === "add-admin" || action === "remove-admin")) {
      const body = await req.json().catch(() => ({}));
      const adding = action === "add-admin";

      // Resolve the target. Adding is by email (case-insensitive, searched
      // across all users, not just the first 1,000); removing is by id.
      let targetId: string | undefined;
      if (adding) {
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!email) throw new HttpError(400, "Email required");
        targetId = (await listAllUsers(adminClient)).find((u) => u.email?.toLowerCase() === email)?.id;
        if (!targetId) throw new HttpError(404, "User not found");
      } else {
        if (!isUuid(body.userId)) throw new HttpError(400, "userId required");
        targetId = body.userId;
      }

      const { data: target } = await adminClient.auth.admin.getUserById(targetId!);
      if (!target?.user) throw new HttpError(404, "User not found");
      const [{ data: roleRows }, { count: adminCount }] = await Promise.all([
        adminClient.from("user_roles").select("role").eq("user_id", targetId!),
        adminClient.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
      ]);

      const decision = decideUserAction({
        action: adding ? "promote" : "demote",
        adminId: ctx.adminId,
        targetId: targetId!,
        targetEmail: target.user.email ?? null,
        targetIsAdmin: (roleRows ?? []).some((r: { role: string }) => r.role === "admin"),
        targetEmailConfirmed: Boolean(target.user.email_confirmed_at),
        adminCount: adminCount ?? 0,
        reason: body.reason,
        data: null,
        confirmEmail: undefined,
        hasPaidSubscription: false,
      });
      if (!decision.ok) throw new HttpError(decision.status, decision.error);

      await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: adding ? "admin_role_grant" : "admin_role_revoke",
          targetType: "user_role",
          targetId: targetId!,
          details: { email: target.user.email, role: "admin", reason: decision.reason },
          meta: ctx.meta,
        },
        async () => {
          const { error } = adding
            ? await adminClient.from("user_roles").insert({ user_id: targetId, role: "admin" })
            : await adminClient.from("user_roles").delete().eq("user_id", targetId).eq("role", "admin");
          if (error) throw error;
        },
      );
      return json({ success: true, userId: targetId }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-settings");
  }
});
