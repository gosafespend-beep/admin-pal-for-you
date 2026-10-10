import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFor, forbidden } from "../_shared/guard.ts";
import { isUuid, json } from "../_shared/http.ts";

/**
 * Turns marketing email off for the person a token belongs to.
 *
 * Public on purpose (recipients are not signed in), so it is deliberately tiny:
 *   POST only, so a mail scanner that merely fetches the link cannot
 *   unsubscribe anyone; the person lands on a page that asks for one click.
 *   The token is a random uuid kept in lifecycle_unsub_tokens, so there is
 *   nothing to guess or sign, and it reveals nothing about whose it is.
 *   A token that does not exist gets the same answer as one that does, minus
 *   the effect, and nothing else is disclosed either way.
 *
 * Mail apps that support one-click unsubscribe (RFC 8058) POST here straight
 * from the List-Unsubscribe header, with the token in the query string.
 * Supabase does not render HTML from functions, so the page people see is a
 * public route on the admin site (/unsubscribe) that calls this.
 */
Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (!cors) return forbidden();
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const fromQuery = new URL(req.url).searchParams.get("t");
  const body = await req.json().catch(() => ({}));
  const token = fromQuery ?? (typeof body?.token === "string" ? body.token : null);
  if (!isUuid(token)) return json({ ok: false }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("lifecycle_unsubscribe", { p_token: token });
  if (error) {
    console.error("lifecycle-unsubscribe failed:", error.message);
    return json({ ok: false }, 500, cors);
  }
  return json({ ok: data === true }, 200, cors);
});
