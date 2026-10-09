import { corsFor, forbidden } from "../_shared/guard.ts";
import { audited } from "../_shared/audit.ts";
import { clampInt, errorResponse, HttpError, isUuid, json, listAllUsers, requireAdmin, selectAll } from "../_shared/http.ts";

const DAY = 24 * 60 * 60 * 1000;
const MIN_REASON = 10;

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

    // POST: extend a trial, cancel or reactivate a subscription.
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { subscriptionId, action, data: actionData } = body;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";

      if (!isUuid(subscriptionId) || !action) throw new HttpError(400, "subscriptionId and action are required");
      if (reason.length < MIN_REASON) throw new HttpError(400, `A reason of at least ${MIN_REASON} characters is required`);
      if (reason.length > 500) throw new HttpError(400, "The reason must be 500 characters or fewer");

      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("id, user_id, status, trial_end, cancelled_at, current_period_end, paystack_subscription_code")
        .eq("id", subscriptionId)
        .maybeSingle();
      if (!sub) throw new HttpError(404, "Subscription not found");

      const now = new Date();
      let updateData: Record<string, unknown> = {};
      const details: Record<string, unknown> = {
        reason,
        before: { status: sub.status, trial_end: sub.trial_end, current_period_end: sub.current_period_end },
      };

      if (action === "cancel" || action === "reactivate") {
        // These rows mirror a payment provider. Editing the local status
        // without telling the provider would hand out free access or hide a
        // charge that is still being taken, so it is refused here.
        const { data: store } = await adminClient
          .from("revenuecat_entitlements")
          .select("user_id")
          .eq("user_id", sub.user_id)
          .eq("is_active", true)
          .neq("period_type", "trial")
          .limit(1);
        if (sub.paystack_subscription_code || (store?.length ?? 0) > 0) {
          throw new HttpError(
            409,
            "This subscription is billed by a payment provider. Cancel or restore it with the provider; changing it here would not stop or start billing",
          );
        }
      }

      switch (action) {
        case "extend_trial": {
          const days = Number(actionData?.days ?? 7);
          if (!Number.isInteger(days) || days < 1 || days > 90) throw new HttpError(400, "Extension must be a whole number of days from 1 to 90");
          if (!sub.trial_end) throw new HttpError(409, "This subscription has no trial to extend");
          const base = Math.max(new Date(sub.trial_end).getTime(), now.getTime());
          updateData = { trial_end: new Date(base + days * DAY).toISOString(), status: "trialing", updated_at: now.toISOString() };
          details.days = days;
          break;
        }
        case "cancel":
          updateData = { status: "cancelled", cancelled_at: now.toISOString(), updated_at: now.toISOString() };
          break;
        case "reactivate":
          updateData = {
            status: "active",
            cancelled_at: null,
            current_period_start: now.toISOString(),
            current_period_end: new Date(now.getTime() + 30 * DAY).toISOString(),
            updated_at: now.toISOString(),
          };
          break;
        default:
          throw new HttpError(400, "Unknown action");
      }
      details.after = updateData;

      await audited(
        adminClient,
        {
          adminUserId: ctx.adminId,
          action: `subscription_${action}`,
          targetType: "subscription",
          targetId: subscriptionId,
          details,
          meta: ctx.meta,
        },
        async () => {
          const { error } = await adminClient.from("subscriptions").update(updateData).eq("id", subscriptionId);
          if (error) throw error;
        },
      );

      return json({ success: true, message: `Subscription ${action.replace("_", " ")} successful` }, 200, cors);
    }

    if (req.method === "GET") {
      const page = clampInt(url.searchParams.get("page"), 1, 1, 10_000);
      const pageSize = clampInt(url.searchParams.get("pageSize"), 20, 1, 100);
      const statusFilter = url.searchParams.get("status") || "";
      const search = (url.searchParams.get("search") || "").trim().toLowerCase().slice(0, 100);

      const [subscriptions, users, healthResult, entitlementsResult] = await Promise.all([
        selectAll(adminClient, "subscriptions", "*"),
        listAllUsers(adminClient),
        adminClient.rpc("entitlement_health"),
        adminClient.from("revenuecat_entitlements").select("*").order("updated_at", { ascending: false }).limit(200),
      ]);
      if (healthResult.error) console.error("entitlement_health:", healthResult.error.message);
      if (entitlementsResult.error) console.error("revenuecat_entitlements:", entitlementsResult.error.message);
      const userMap = new Map(users.map((u) => [u.id, u]));

      subscriptions.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      let enriched = subscriptions.map((sub) => ({
        ...sub,
        userEmail: userMap.get(sub.user_id)?.email || "Unknown",
        userCreatedAt: userMap.get(sub.user_id)?.created_at,
      }));
      if (statusFilter) enriched = enriched.filter((s) => s.status === statusFilter);
      if (search) enriched = enriched.filter((s) => s.userEmail.toLowerCase().includes(search));

      const offset = (page - 1) * pageSize;
      const count = (status: string) => subscriptions.filter((s) => s.status === status).length;

      return json(
        {
          subscriptions: enriched.slice(offset, offset + pageSize),
          total: enriched.length,
          // Stats cover every subscription, not just the filtered view.
          stats: {
            total: subscriptions.length,
            active: count("active"),
            trialing: count("trialing"),
            cancelled: count("cancelled"),
            expired: count("expired"),
          },
          entitlementHealth: (healthResult.data || []) as Array<{ check_name: string; severity: string; affected: number; detail: string }>,
          entitlements: (entitlementsResult.data || []).map((e: Record<string, unknown>) => ({
            ...e,
            userEmail: userMap.get(e.user_id as string)?.email || "Unknown",
          })),
        },
        200,
        cors,
      );
    }

    return json({ error: "Method not allowed" }, 405, cors);
  } catch (error) {
    return errorResponse(error, cors, requestId, "admin-subscriptions");
  }
});
