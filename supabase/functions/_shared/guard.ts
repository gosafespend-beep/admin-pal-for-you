/**
 * Request guards for the admin panel's edge functions.
 *
 * All twelve answered Access-Control-Allow-Origin: "*". Each one does check
 * is_admin() with the caller's own token, so this is not the control that keeps
 * strangers out -- it is the layer that stops any page on the internet from
 * making an admin's authenticated browser issue those calls on their behalf.
 *
 * Deliberately a narrower list than the web app's: nothing but the admin panel
 * should ever reach these from a browser.
 */

const ALLOWED_ORIGINS = new Set([
  "https://admin.gosafespend.com",
]);

const DEV_ORIGIN = /^http:\/\/localhost:\d+$/;

const BASE_HEADERS = {
  /*
   * Must name every header a caller may send: a preflight requesting one that
   * is absent here is rejected by the browser and the real call never happens,
   * which presents as the function being down. This is the union of what the
   * functions already allowed between them.
   */
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].join(", "),
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "3600",
  Vary: "Origin",
};

/**
 * CORS headers for an allowed origin, or null to reject.
 *
 * A request with no Origin header is allowed through. Browsers always send one,
 * so its absence means the caller is not a web page -- curl, a server, a native
 * app. Those are gated by the is_admin() check inside each function, which is
 * the real authorisation and does not depend on this.
 */
export function corsFor(req: Request): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (origin === null) return { ...BASE_HEADERS };
  if (ALLOWED_ORIGINS.has(origin) || DEV_ORIGIN.test(origin)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  // Logged so a legitimate origin we failed to anticipate shows up as a log
  // line rather than as an admin reporting that the dashboard is broken.
  console.warn(`CORS: rejected origin ${origin} for ${new URL(req.url).pathname}`);
  return null;
}

export function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
