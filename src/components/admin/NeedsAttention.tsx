import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellOff, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useOpsAlerts, type OpsAlert } from "@/hooks/admin/useAdminAlerts";
import { summarizeAlerts } from "@/lib/shell";
import { cn } from "@/lib/utils";

/** Where each kind of alert is dealt with, so a click goes straight to the fix. */
const WHERE: Array<[RegExp, string]> = [
  [/^marketing:/, "/marketing"],
  [/^privacy:/, "/data-requests"],
  [/^security:/, "/users"],
  [/^health:/, "/system"],
  [/^lifecycle:/, "/messages"],
];
const target = (a: OpsAlert) => WHERE.find(([re]) => re.test(a.fingerprint))?.[1] ?? "/alerts";

const MAX_SHOWN = 4;

/**
 * The first thing on the dashboard: what is wrong right now, drawn from the same
 * monitor that emails you. Quiet when all is well, so a calm dashboard means a
 * healthy platform, not just one that has not looked.
 */
export function NeedsAttention() {
  const { data, isLoading, error } = useOpsAlerts();
  if (isLoading || error || !data) return null;

  const now = new Date();
  const summary = summarizeAlerts(data.active, now);
  const live = data.active
    .filter((a) => !(a.acknowledged_until && new Date(a.acknowledged_until) > now))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "problem" ? -1 : 1));

  if (summary.needsAttention === 0) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <span>Nothing needs your attention right now.</span>
        {summary.paused > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BellOff className="h-3 w-3" aria-hidden="true" />{summary.paused} paused
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("glass-card border-l-4", summary.tone === "problem" ? "border-l-destructive" : "border-l-warning")}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {summary.needsAttention} {summary.needsAttention === 1 ? "thing needs" : "things need"} your attention
          </h2>
          <Link to="/alerts" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            All alerts <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        <ul className="space-y-2">
          {live.slice(0, MAX_SHOWN).map((a) => {
            const Icon = a.severity === "problem" ? XCircle : AlertTriangle;
            return (
              <li key={a.fingerprint}>
                <Link to={target(a)} className="group flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.severity === "problem" ? "text-destructive" : "text-warning")} aria-hidden="true" />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{a.title}</span>
                    <span className="sr-only">{a.severity === "problem" ? " (problem)" : " (warning)"}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                  <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        {live.length > MAX_SHOWN && <p className="mt-2 pl-2 text-xs text-muted-foreground">and {live.length - MAX_SHOWN} more</p>}
      </CardContent>
    </Card>
  );
}
