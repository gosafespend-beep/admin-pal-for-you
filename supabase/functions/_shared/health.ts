/**
 * Live health checks: ask each service whether it answers, and read the
 * database-side facts. Used by the System health page and the monitor.
 *
 * Provider checks make one cheap authenticated read each (Paystack balance,
 * Resend domains, Anthropic model list). Responses are never returned or
 * stored beyond a fixed status sentence, so no balance, key or customer data
 * can leak through this. Each call has a 6 second limit so one slow provider
 * cannot hold up the page.
 */
import type { AnyClient } from "./http.ts";
import { SLOW_DB_MS, type HealthReport, type HealthSignals, type ServiceCheck } from "./healthRules.ts";

const TIMEOUT_MS = 6000;

async function timed(
  key: string,
  label: string,
  run: () => Promise<{ status: ServiceCheck["status"]; detail: string }>,
): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { status, detail } = await run();
    return { key, label, status, latencyMs: Date.now() - start, detail };
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`health: ${key} check threw`, e instanceof Error ? e.message : e);
    return { key, label, status: "warning", latencyMs: Date.now() - start, detail: timedOut ? `${label} did not answer within ${TIMEOUT_MS / 1000} seconds.` : `${label} could not be reached.` };
  }
}

const get = (url: string, headers: Record<string, string>) =>
  fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

export async function collectHealth(admin: AnyClient): Promise<HealthReport> {
  const [database, auth, storage, paystack, resend, anthropic, signals] = await Promise.all([
    timed("database", "Database", async () => {
      const start = Date.now();
      const { error } = await admin.from("profiles").select("id", { count: "exact", head: true });
      if (error) return { status: "problem", detail: "The database did not answer a simple query." };
      const ms = Date.now() - start;
      return ms > SLOW_DB_MS ? { status: "warning", detail: `A simple query took ${ms} ms.` } : { status: "ok", detail: "" };
    }),
    timed("auth", "Sign-in service", async () => {
      const { error } = await admin.auth.admin.listUsers({ perPage: 1 });
      return error ? { status: "problem", detail: "The sign-in service did not answer." } : { status: "ok", detail: "" };
    }),
    timed("storage", "File storage", async () => {
      const { error } = await admin.storage.listBuckets();
      return error ? { status: "problem", detail: "File storage did not answer." } : { status: "ok", detail: "" };
    }),
    timed("paystack", "Paystack (web payments)", async () => {
      const key = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!key) return { status: "problem", detail: "The Paystack key is not set on the server, so web payments cannot work." };
      const res = await get("https://api.paystack.co/balance", { Authorization: `Bearer ${key}` });
      await res.body?.cancel();
      if (res.ok) return { status: "ok", detail: "" };
      if (res.status === 401 || res.status === 403) return { status: "problem", detail: "Paystack rejected our key. Web payments and subscription changes will fail." };
      return { status: "warning", detail: `Paystack answered with an error (${res.status}).` };
    }),
    timed("resend", "Resend (email)", async () => {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return { status: "problem", detail: "The email key is not set on the server, so no email can be sent, including alerts." };
      const res = await get("https://api.resend.com/domains", { Authorization: `Bearer ${key}` });
      if (res.status === 401 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        // A key limited to sending cannot list domains. That is a good key, just one we cannot inspect.
        if (body?.name === "restricted_api_key") return { status: "unknown", detail: "Reachable. The key can only send, so the sender domain could not be checked." };
        return { status: "problem", detail: "The email provider rejected our key. No email, including alerts, will be sent." };
      }
      if (!res.ok) { await res.body?.cancel(); return { status: "warning", detail: `The email provider answered with an error (${res.status}).` }; }
      const body = await res.json().catch(() => ({}));
      const domains: Array<{ name?: string; status?: string }> = Array.isArray(body?.data) ? body.data : [];
      const mine = domains.find((d) => d.name === "gosafespend.com");
      if (!mine) return { status: "warning", detail: "gosafespend.com is not listed as a sending domain, so mail from it may be refused." };
      if (mine.status !== "verified") return { status: "problem", detail: `The sender domain gosafespend.com is "${mine.status ?? "unknown"}", not verified. Mail from it may be refused.` };
      return { status: "ok", detail: "" };
    }),
    timed("anthropic", "Anthropic (AI)", async () => {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      if (!key) return { status: "problem", detail: "The AI key is not set on the server." };
      const res = await get("https://api.anthropic.com/v1/models?limit=1", { "x-api-key": key, "anthropic-version": "2023-06-01" });
      await res.body?.cancel();
      if (res.ok) return { status: "ok", detail: "The key is valid. This does not check the credit balance; the Marketing page shows that." };
      if (res.status === 401 || res.status === 403) return { status: "problem", detail: "The AI provider rejected our key." };
      return { status: "warning", detail: `The AI provider answered with an error (${res.status}).` };
    }),
    admin.rpc("admin_health_signals"),
  ]);

  if (signals.error) throw new Error(`admin_health_signals failed: ${signals.error.message}`);
  return {
    generatedAt: new Date().toISOString(),
    services: [database, auth, storage, paystack, resend, anthropic],
    signals: signals.data as HealthSignals,
  };
}
