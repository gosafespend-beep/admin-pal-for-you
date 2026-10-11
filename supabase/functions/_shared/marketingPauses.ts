/**
 * Reads the open pauses (things paused from the Marketing page and not yet
 * resumed) in the shape the rules and the page use. Shared by the Marketing
 * function and the monitor so both see the same picture.
 */
import type { AnyClient } from "./http.ts";
import type { MarketingOverview } from "./marketingRules.ts";

type Pauses = NonNullable<MarketingOverview["pauses"]>;

export async function loadPauses(admin: AnyClient): Promise<Pauses> {
  const { data, error } = await admin
    .from("marketing_pauses")
    .select("scope, target, reason, paused_at, batch")
    .is("resumed_at", null)
    .order("paused_at", { ascending: true });
  if (error) throw new Error(`reading marketing_pauses failed: ${error.message}`);
  return (data ?? []).map((r: { scope: "agent" | "channel"; target: string; reason: string; paused_at: string; batch: string | null }) => ({
    scope: r.scope, target: r.target, reason: r.reason, pausedAt: r.paused_at, batch: r.batch,
  }));
}
