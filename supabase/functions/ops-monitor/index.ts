import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFor, forbidden } from "../_shared/guard.ts";
import { json } from "../_shared/http.ts";
import { runOpsMonitor, sendMonitorFailure } from "../_shared/opsMonitor.ts";

/**
 * The scheduled monitor (every 30 minutes, see migration 12).
 *
 * Auth is the same as the billing monitor: the shared secret in Vault, checked
 * by the database (monitor_secret_matches), which only answers yes or no. The
 * function never holds the secret. Anything else is refused.
 *
 * It emails only when something is new, as a reminder while a problem stays
 * open, or when something is fixed. Silence means nothing has changed.
 */
Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const provided = req.headers.get("x-cron-secret");
  if (!provided) return json({ error: "Forbidden" }, 403, cors);
  const { data: ok, error: secretError } = await admin.rpc("monitor_secret_matches", { candidate: provided });
  if (secretError || ok !== true) return json({ error: "Forbidden" }, 403, cors);

  try {
    const result = await runOpsMonitor(admin, { notify: true });
    return json({ ok: true, ...result }, 200, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ops-monitor failed:", message);
    // Runs every 30 minutes, so mail about the monitor's own failure only in the
    // first half hour of every sixth hour: a broken monitor must be loud, not a flood.
    const now = new Date();
    if (now.getUTCHours() % 6 === 0 && now.getUTCMinutes() < 30) await sendMonitorFailure(message);
    return json({ ok: false, error: "monitor_failed" }, 500, cors);
  }
});
