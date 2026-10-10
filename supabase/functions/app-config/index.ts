import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPublicConfig, parseClientInfo, type Control, type Flag } from "../_shared/controlRules.ts";

/**
 * What the apps are told at start-up. PUBLIC: no sign-in, any origin, because
 * the web app, the iOS app and the Android app all call it before anyone logs in.
 *
 *   GET ?platform=ios|android|web&v=1.4.0&id=<stable anonymous id>
 *
 * Safe to be public because it only ever returns what an admin chose to show
 * every user: a banner, whether an update is needed, and flags marked public.
 * It takes no free text (platform, version and id are checked against strict
 * patterns and anything odd is dropped), writes nothing, and never returns
 * internal flags or any other setting.
 *
 * Apps must FAIL OPEN: if this call fails or times out, carry on as normal.
 * This function being down must never lock anyone out.
 */
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "3600",
  "Content-Type": "application/json",
};

const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: HEADERS });
  if (req.method !== "GET") return reply({ error: "Method not allowed" }, 405);

  const client = parseClientInfo(new URL(req.url).searchParams);
  if (!client) return reply({ error: "platform must be ios, android or web" }, 400);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const [control, flags] = await Promise.all([
      admin.from("app_control").select("*").eq("id", 1).maybeSingle(),
      admin.from("app_flags").select("key, description, enabled, rollout_pct, platforms, public").eq("public", true),
    ]);
    if (control.error || flags.error || !control.data) throw new Error(control.error?.message ?? flags.error?.message ?? "no app_control row");

    const config = buildPublicConfig(control.data as Control, (flags.data ?? []) as Flag[], client);
    // A minute of caching keeps a busy launch from hammering the database; a change reaches everyone within about that long.
    return reply(config, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
  } catch (error) {
    console.error("app-config failed:", error instanceof Error ? error.message : error);
    return reply({ ok: false }, 500, { "Cache-Control": "no-store" });
  }
});
