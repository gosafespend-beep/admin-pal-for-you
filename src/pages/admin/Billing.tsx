import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, DollarSign, RefreshCw, TrendingDown, Users, Wallet,
} from "lucide-react";
import { useAdminBilling } from "@/hooks/admin/useAdminBilling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function Kpi({ icon: Icon, label, value, hint, tone = "primary" }: {
  icon: React.ElementType; label: string; value: React.ReactNode; hint?: string;
  tone?: "primary" | "info" | "purple" | "warning" | "destructive";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary", info: "bg-info/10 text-info", purple: "bg-purple/10 text-purple",
    warning: "bg-warning/10 text-warning", destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="glass-card">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonLink({ userId, email }: { userId: string; email: string | null }) {
  return (
    <Link to={`/users/${userId}`} className="text-primary hover:underline break-all">
      {email ?? userId.slice(0, 8)}
    </Link>
  );
}

export default function Billing() {
  const { data, isLoading, error, refetch, isFetching } = useAdminBilling();

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState
          icon={CreditCard}
          title="Failed to load billing"
          description={error.message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const c = data?.customers;
  const paying = (c?.paystack ?? 0) + (c?.store ?? 0);
  const t = data?.trialToPaid;
  const enoughForRate = (t?.trialsEnded ?? 0) >= 10;
  const unhealthy = (data?.health ?? []).filter((h) => h.severity !== "ok");
  const attentionCount =
    (data?.attention.staleTrials.count ?? 0) + (data?.attention.paidWithoutPeriodEnd.count ?? 0) + unhealthy.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Billing</h1>
          <p className="text-muted-foreground">
            Web (Paystack) and app store subscriptions in one place. Revenue figures are estimates from list prices.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/subscriptions">Manage subscriptions</Link>
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 shimmer rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Kpi icon={DollarSign} label="Monthly recurring revenue (est.)" value={usd(data.mrr.total)} hint="Paying customers x list price" />
            <Kpi icon={Wallet} label="Annualised (est.)" value={usd(data.arr)} tone="info" />
            <Kpi icon={Users} label="Paying customers" value={paying} hint={`${c!.paystack} web, ${c!.store} app store`} tone="purple" />
            <Kpi icon={Clock} label="Live trials" value={c!.liveTrials} hint={`${data.trialsEndingSoon.length} ending within 7 days`} tone="warning" />
            <Kpi icon={TrendingDown} label="Cancellations, last 30 days" value={data.last30d.cancellations + data.last30d.storeExpirations} hint={`${data.last30d.trialsStarted} trials started`} tone="destructive" />
            <Kpi
              icon={enoughForRate ? CheckCircle2 : AlertTriangle}
              label="Trial to paid"
              value={enoughForRate ? `${Math.round((t!.converted / t!.trialsEnded) * 1000) / 10}%` : "Too few yet"}
              hint={`${t!.converted} of ${t!.trialsEnded} ended trials${enoughForRate ? "" : " (need 10+ for a meaningful rate)"}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Customers by source</CardTitle>
                <CardDescription>Only production purchases count; sandbox purchases are ignored</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Web (Paystack)", n: c!.paystack, mrr: data.mrr.paystack },
                  { label: "App Store / Google Play", n: c!.store, mrr: data.mrr.store },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/50 p-3">
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-sm text-muted-foreground">{r.n} paying · {usd(r.mrr)}/mo</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/50 p-3">
                  <span className="text-sm font-medium">Granted (no billing)</span>
                  <span className="text-sm text-muted-foreground">{c!.granted}</span>
                </div>
                {c!.sandboxIgnored > 0 && (
                  <p className="text-xs text-muted-foreground">{c!.sandboxIgnored} sandbox test purchase{c!.sandboxIgnored === 1 ? "" : "s"} excluded.</p>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Trials ending in the next 7 days</CardTitle>
                <CardDescription>The best moment to nudge someone to subscribe</CardDescription>
              </CardHeader>
              <CardContent>
                {data.trialsEndingSoon.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.trialsEndingSoon.map((p) => (
                      <li key={`${p.source}-${p.userId}`} className="flex items-center justify-between gap-3 text-sm">
                        <PersonLink userId={p.userId} email={p.email} />
                        <span className="shrink-0 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="mr-2">{p.source === "store" ? "store" : "web"}</Badge>
                          {formatDistanceToNow(new Date(p.endsAt), { addSuffix: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {attentionCount === 0 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-warning" />}
                Needs attention
              </CardTitle>
              <CardDescription>Things in the billing data that look wrong or stale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {attentionCount === 0 && <p className="text-sm text-muted-foreground">Nothing looks off.</p>}

              {data.attention.staleTrials.count > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium">{data.attention.staleTrials.count} trials ended but are still marked "trialing"</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nothing changes this status when a trial ends. The panel now treats them as expired, so counts are right, but the stored value is stale. Examples:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data.attention.staleTrials.sample.map((p) => (
                      <li key={p.userId} className="flex justify-between gap-3">
                        <PersonLink userId={p.userId} email={p.email} />
                        <span className="text-xs text-muted-foreground">ended {format(new Date(p.trialEnd), "MMM d, yyyy")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.attention.paidWithoutPeriodEnd.count > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium">{data.attention.paidWithoutPeriodEnd.count} paying subscription{data.attention.paidWithoutPeriodEnd.count === 1 ? " has" : "s have"} no renewal date</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paystack should send the next billing date; a missing one means the webhook may not have updated this row.
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {data.attention.paidWithoutPeriodEnd.sample.map((p) => (
                      <li key={p.userId}><PersonLink userId={p.userId} email={p.email} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {unhealthy.map((h) => (
                <div key={h.check_name} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-sm font-medium">{h.check_name.replace(/_/g, " ")} ({h.affected})</p>
                  <p className="text-xs text-muted-foreground">{h.detail}</p>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3">
                {data.health.map((h) => (
                  <Badge
                    key={h.check_name}
                    className={cn("border text-xs", h.severity === "ok" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20")}
                  >
                    {h.check_name.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
