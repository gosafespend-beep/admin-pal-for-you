import type { GrowthMetrics } from "@/hooks/admin/useAdminGrowth";

/** Rates over fewer people than this are noise; the page says so instead of showing a percentage. */
export const MIN_SAMPLE = 10;

export function pct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Share of everyone who signed up in the window, or null when nobody did. */
  ofSignups: number | null;
  /** Where the number comes from, because event-based steps only cover people the app tracked. */
  source: "database" | "app events";
}

export function funnelSteps(f: GrowthMetrics["funnel"]): FunnelStep[] {
  const rows: Array<[string, string, number, FunnelStep["source"]]> = [
    ["signedUp", "Signed up", f.signedUp, "database"],
    ["setUp", "Set up an account", f.setUp, "database"],
    ["onboarded", "Finished onboarding", f.onboarded, "app events"],
    ["activated", "Logged a transaction", f.activated, "database"],
    ["sawPaywall", "Saw the paywall", f.sawPaywall, "app events"],
    ["checkout", "Started checkout", f.checkout, "app events"],
    ["paid", "Pays", f.paid, "database"],
  ];
  return rows.map(([key, label, count, source]) => ({ key, label, count, source, ofSignups: pct(count, f.signedUp) }));
}

/**
 * The one sentence worth putting at the top: when almost nobody who signs up
 * ever uses the product, every acquisition and pricing question comes second.
 * Returns null unless there are enough sign-ups for the figure to mean something.
 */
export function headline(f: GrowthMetrics["funnel"]): string | null {
  if (f.signedUp < MIN_SAMPLE) return null;
  const activation = pct(f.activated, f.signedUp) ?? 0;
  if (activation >= 10) return null;
  return `Only ${f.activated} of ${f.signedUp} sign-ups (${activation}%) have logged a transaction. ${f.setUp} set up an account, so people get in but don't start using it.`;
}

export function retentionRate(r: { eligible: number; retained: number }): { rate: number | null; enough: boolean } {
  return { rate: pct(r.retained, r.eligible), enough: r.eligible >= MIN_SAMPLE };
}
