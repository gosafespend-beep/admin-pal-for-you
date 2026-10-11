import { format, formatDistanceToNow } from "date-fns";
import { Check, Circle, Globe, Smartphone, Bell, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserOverview } from "@/hooks/admin/useAdminUserDetail";
import { cn } from "@/lib/utils";

const when = (iso: string | null | undefined, withTime = false) =>
  iso ? format(new Date(iso), withTime ? "MMM d, yyyy HH:mm" : "MMM d, yyyy") : null;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

const MILESTONES: Array<{ key: keyof UserOverview["milestones"]; label: string }> = [
  { key: "signup", label: "Signed up" },
  { key: "onboardingComplete", label: "Finished onboarding" },
  { key: "firstTransaction", label: "Logged a first transaction" },
  { key: "paywallView", label: "Saw the paywall" },
  { key: "checkoutStart", label: "Started checkout" },
  { key: "purchaseSuccess", label: "Purchased" },
];

export function OverviewTab({ overview }: { overview: UserOverview }) {
  const a = overview.acquisition;
  const c = overview.counts;
  const n = overview.notifications;
  const currencies = [...new Set(overview.accounts.map((x) => x.currency))];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Journey</CardTitle>
          <CardDescription>First time each step happened (from app events)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {MILESTONES.map((m) => {
            const at = overview.milestones[m.key] as string | null;
            return (
              <div key={m.key} className="flex items-center gap-3 text-sm">
                {at ? <Check className="h-4 w-4 text-primary shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                <span className={cn(!at && "text-muted-foreground")}>{m.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{at ? when(at) : "not yet"}</span>
              </div>
            );
          })}
          <p className="pt-2 text-xs text-muted-foreground">
            Older accounts predate some events, so a missing step doesn't always mean it didn't happen.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4 text-info" /> Where they came from</CardTitle>
          <CardDescription>Recorded when the account was created</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Source" value={a?.source} />
          <Field label="Medium" value={a?.medium} />
          <Field label="Campaign" value={a?.campaign} />
          <Field label="Country" value={a?.country} />
          <Field label="Landing page" value={a?.landingPath} />
          <Field label="Acquired" value={when(a?.acquiredAt)} />
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-purple" /> Apps used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.platforms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No app events recorded (web-only or older account).</p>
          ) : (
            overview.platforms.map((p) => (
              <div key={p.platform} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/50 p-3">
                <Badge className="capitalize bg-primary/10 text-primary border border-primary/20">{p.platform}</Badge>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{p.events} events</p>
                  <p>last seen {formatDistanceToNow(new Date(p.lastSeen), { addSuffix: true })}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-warning" /> What they've set up</CardTitle>
          <CardDescription>Counts only; amounts and notes stay hidden by default</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Expenses", c.expenses], ["Incomes", c.incomes], ["Transfers", c.transfers],
              ["Accounts", c.accounts], ["Budgets", c.budgets], ["Goals", c.goals],
              ["Bills", c.bills], ["Debts", c.debts], ["Recurring", c.recurring],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-border/30 bg-card/50 p-3">
                <p className="text-xl font-bold text-foreground">{value as number}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Currencies:</span>
            {currencies.length === 0 ? <span className="text-muted-foreground">none</span> : currencies.map((cur) => (
              <Badge key={cur} variant="secondary">{cur}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Last transaction logged: {overview.lastTransactionAt ? formatDistanceToNow(new Date(overview.lastTransactionAt), { addSuffix: true }) : "never"}
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-pink" /> Email and notification choices</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {n ? (
            [
              ["Bill reminders", n.billReminders], ["Budget alerts", n.budgetAlerts],
              ["Weekly summary", n.weeklySummary], ["Marketing emails", n.marketingEmails],
            ].map(([label, on]) => (
              <Badge key={label as string} className={cn("border", on ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border")}>
                {label as string}: {on ? "on" : "off"}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No preferences saved (defaults apply).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ActivityTab({ overview }: { overview: UserOverview }) {
  const items = overview.timeline;
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Last {items.length} of {overview.milestones.events} app events (event names only, no content)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No app events for this person.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border/40 pl-5">
            {items.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary/60" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{e.event.replace(/_/g, " ")}</span>
                  {e.platform && <Badge variant="secondary" className="capitalize text-xs">{e.platform}</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{when(e.at, true)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function StoreEntitlements({ overview }: { overview: UserOverview }) {
  if (overview.entitlements.length === 0) {
    return <p className="text-sm text-muted-foreground">No App Store or Google Play entitlement on file.</p>;
  }
  return (
    <div className="space-y-3">
      {overview.entitlements.map((e) => (
        <div key={`${e.entitlement}-${e.product_id}`} className="grid gap-3 rounded-lg border border-border/30 bg-card/50 p-4 sm:grid-cols-3">
          <Field label="Store" value={<span className="capitalize">{e.store}{e.environment ? ` (${e.environment.toLowerCase()})` : ""}</span>} />
          <Field label="Product" value={e.product_id} />
          <Field label="Status" value={<Badge className={cn("border", e.is_active ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border")}>{e.is_active ? "active" : e.status}</Badge>} />
          <Field label="Period" value={e.period_type} />
          <Field label="Purchased" value={when(e.purchased_at)} />
          <Field label="Expires" value={when(e.expires_at)} />
        </div>
      ))}
    </div>
  );
}
