import { cn } from "@/lib/utils";
import type { FunnelStep } from "@/hooks/admin/useAdminAnalytics";

const STEP_LABELS: Record<string, string> = {
  welcome_start: "Welcome started",
  welcome_complete: "Welcome completed",
  signup: "Signed up",
  onboarding_complete: "Onboarding completed",
  first_transaction: "First transaction",
  paywall_view: "Paywall viewed",
  plan_select: "Plan selected",
  checkout_start: "Checkout started",
  purchase_success: "Purchase completed",
};

export function FunnelSteps({ steps, accent = "primary" }: { steps: FunnelStep[]; accent?: "primary" | "purple" }) {
  if (!steps?.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No events recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.step} className="space-y-1">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="font-medium text-foreground">{STEP_LABELS[s.step] ?? s.step}</span>
            <span className="flex items-center gap-3">
              <span className="font-bold text-foreground tabular-nums">{s.count.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{s.pctOfFirst}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn("h-full rounded-full", accent === "purple" ? "bg-purple" : "bg-primary")}
              style={{ width: `${Math.max(s.pctOfFirst, 1)}%` }}
            />
          </div>
          {i > 0 && s.dropoffFromPrev > 0 && (
            <p className="text-xs text-destructive">-{s.dropoffFromPrev}% from previous step</p>
          )}
        </div>
      ))}
    </div>
  );
}
