import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { errorResponse, HttpError, isUuid, json, requireAdmin, type AdminContext } from "../_shared/http.ts";
import { decideUserAction } from "../_shared/userActionRules.ts";

/**
 * Account actions: suspend, unsuspend, delete, promote, demote, resend.
 *
 * The rules (who may act on whom, required reasons, last-admin protection)
 * live in ../_shared/userActionRules.ts and are unit-tested; this file gathers
 * the facts, asks the rules, writes the audit row first, then acts.
 */

async function revokeAllSessions(ctx: AdminContext, userId: string): Promise<number> {
  const { data: sessions } = await ctx.adminClient.rpc("list_user_sessions", { p_user_id: userId });
  let revoked = 0;
  for (const s of (sessions ?? []) as Array<{ session_id: string }>) {
    const { data } = await ctx.adminClient.rpc("revoke_user_session", {
      p_user_id: userId,
      p_session_id: s.session_id,
    });
    if (data) revoked++;
  }
  return revoked;
}

async function hasActivePaidSubscription(ctx: AdminContext, userId: string): Promise<boolean> {
  const [paystack, stores] = await Promise.all([
    ctx.adminClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .not("paystack_subscription_code", "is", null)
      .limit(1),
    ctx.adminClient
      .from("revenuecat_entitlements")
      .select("user_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .neq("period_type", "trial")
      .limit(1),
  ]);
  return (paystack.data?.length ?? 0) > 0 || (stores.data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  let requestId: string | undefined;
  try {
    const ctx = await requireAdmin(req, cors);
    if (ctx instanceof Response) return ctx;
    requestId = ctx.meta.requestId;

    const body = await req.json().catch(() => null);
    const { action, userId, data, reason } = (body ?? {}) as Record<string, unknown>;
    if (!isUuid(userId)) throw new HttpError(400, "A valid userId is required");

    const { data: target, error: targetError } = await ctx.adminClient.auth.admin.getUserById(userId);
    if (targetError || !target?.user) throw new HttpError(404, "User not found");

    const [{ data: roleRows }, { count: adminCount }] = await Promise.all([
      ctx.adminClient.from("user_roles").select("role").eq("user_id", userId),
      ctx.adminClient.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    ]);

    const decision = decideUserAction({
      action,
      adminId: ctx.adminId,
      targetId: userId,
      targetEmail: target.user.email ?? null,
      targetIsAdmin: (roleRows ?? []).some((r: { role: string }) => r.role === "admin"),
      targetEmailConfirmed: Boolean(target.user.email_confirmed_at),
      adminCount: adminCount ?? 0,
      reason,
      data,
      confirmEmail: (data as { confirmEmail?: unknown } | null)?.confirmEmail,
      hasPaidSubscription: action === "delete" ? await hasActivePaidSubscription(ctx, userId) : false,
    });
    if (!decision.ok) throw new HttpError(decision.status, decision.error);

    const entry = {
      adminUserId: ctx.adminId,
      action: decision.action,
      targetType: "user",
      targetId: userId,
      details: {
        reason: decision.reason || undefined,
        target_email: target.user.email,
        duration_days: decision.suspendDays,
      },
      meta: ctx.meta,
    };

    let message: string;

    switch (decision.action) {
      case "suspend": {
        const hours = (decision.suspendDays as number) * 24;
        const revoked = await audited(
          ctx.adminClient,
          entry,
          async () => {
            // GoTrue parses Go durations ("720h"); "30d" is not valid and made
            // every suspension fail.
            const { error } = await ctx.adminClient.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` });
            if (error) throw error;
            return await revokeAllSessions(ctx, userId);
          },
          (n) => ({ sessions_revoked: n }),
        );
        message = `User suspended for ${decision.suspendDays} days; ${revoked} active session(s) signed out`;
        break;
      }

      case "unsuspend": {
        await audited(ctx.adminClient, entry, async () => {
          const { error } = await ctx.adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
          if (error) throw error;
        });
        message = "User suspension lifted";
        break;
      }

      case "delete": {
        await audited(
          ctx.adminClient,
          entry,
          async () => {
            // Remove the app data first (the same routine used for self-service
            // deletion), then the auth account.
            const { data: rows, error: dataError } = await ctx.adminClient.rpc("delete_user_data", {
              _uid: userId,
              _dry_run: false,
            });
            if (dataError) throw dataError;
            const { error } = await ctx.adminClient.auth.admin.deleteUser(userId);
            if (error) throw error;
            return rows as Array<{ table_name: string; action: string; rows_affected: number }>;
          },
          (rows) => ({ tables_touched: (rows ?? []).filter((r) => Number(r.rows_affected) > 0).length }),
        );
        message = "User and their data deleted permanently";
        break;
      }

      case "promote": {
        await audited(ctx.adminClient, entry, async () => {
          const { error } = await ctx.adminClient.from("user_roles").insert({ user_id: userId, role: "admin" });
          if (error) throw error;
        });
        message = "User promoted to admin";
        break;
      }

      case "demote": {
        await audited(ctx.adminClient, entry, async () => {
          const { error } = await ctx.adminClient.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
          if (error) throw error;
        });
        message = "Admin privileges removed";
        break;
      }

      case "resend_confirmation": {
        await audited(ctx.adminClient, entry, async () => {
          const { error } = await ctx.adminClient.auth.resend({ type: "signup", email: target.user.email! });
          if (error) throw error;
        });
        message = "Confirmation email sent";
        break;
      }
    }

    return json({ success: true, message }, 200, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-user-actions");
  }
});
