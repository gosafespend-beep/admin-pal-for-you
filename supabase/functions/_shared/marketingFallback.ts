import type { AnyClient } from "./http.ts";
import type { MarketingOverview } from "./marketingRules.ts";
import { OPENAI_MODEL_PREFIX, parseFallbackKind } from "./aiFallback.ts";

type Fallback = NonNullable<MarketingOverview["fallback"]>;

/**
 * How many marketing runs in the last 24 hours succeeded on the OpenAI backup, and why Anthropic was skipped.
 * agent-run marks such a run with the model "openai:<name>" and a note in the error column.
 *
 * Best effort: if this cannot be read the monitor carries on without the warning, rather than reporting
 * that the whole monitor failed.
 */
export async function loadFallback(admin: AnyClient, now: Date = new Date()): Promise<Fallback> {
  const none: Fallback = { runs24h: 0, lastAt: null, kind: null };
  try {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("sgs_action_log")
      .select("error, created_at")
      .like("model", `${OPENAI_MODEL_PREFIX}%`)
      .eq("ok", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ error: string | null; created_at: string }>;
    if (rows.length === 0) return none;
    return { runs24h: rows.length, lastAt: rows[0].created_at, kind: parseFallbackKind(rows[0].error) };
  } catch (e) {
    console.error("loadFallback failed:", e instanceof Error ? e.message : e);
    return none;
  }
}
