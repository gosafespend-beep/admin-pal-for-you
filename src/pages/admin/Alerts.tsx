import { useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, BellOff, BellRing, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAlertActions, useOpsAlerts, type OpsAlert } from "@/hooks/admin/useAdminAlerts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReasonConfirmDialog } from "@/components/admin/ReasonConfirmDialog";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never");
const day = (iso: string) => format(new Date(iso), "MMM d, yyyy");

/** Where to go to deal with each kind of alert. */
const WHERE: Array<[RegExp, string, string]> = [
  [/^marketing:/, "/marketing", "Open Marketing"],
  [/^privacy:/, "/data-requests", "Open Data requests"],
  [/^security:/, "/users", "Open Users"],
];

function AlertCard({ a, onAck, onUnack, busy }: { a: OpsAlert; onAck: () => void; onUnack: () => void; busy: boolean }) {
  const paused = !!a.acknowledged_until && new Date(a.acknowledged_until) > new Date();
  const link = WHERE.find(([re]) => re.test(a.fingerprint));
  const Icon = a.severity === "problem" ? XCircle : AlertTriangle;
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", a.severity === "problem" ? "text-destructive" : "text-warning")} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{a.title}</p>
            <Badge variant="outline" className="capitalize">{a.severity}</Badge>
            {paused && <Badge variant="secondary" className="gap-1"><BellOff className="h-3 w-3" />Paused until {day(a.acknowledged_until!)}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground break-words">{a.detail}</p>
          <p className="text-xs text-muted-foreground">
            Open since {day(a.first_seen_at)} · {a.notify_count === 0 ? "not emailed yet" : `emailed ${a.notify_count} time${a.notify_count === 1 ? "" : "s"}, last ${ago(a.last_notified_at)}`}
          </p>
          {paused && a.acknowledged_reason && <p className="text-xs text-muted-foreground">Paused because: {a.acknowledged_reason}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 pl-8">
        {link && <Button asChild size="sm" variant="outline"><Link to={link[1]}>{link[2]}</Link></Button>}
        {paused
          ? <Button size="sm" variant="ghost" onClick={onUnack} disabled={busy}><BellRing className="mr-2 h-4 w-4" />Turn reminders back on</Button>
          : <Button size="sm" variant="ghost" onClick={onAck} disabled={busy}><BellOff className="mr-2 h-4 w-4" />Pause reminders</Button>}
      </div>
    </div>
  );
}

export default function Alerts() {
  const { data, isLoading, error, refetch } = useOpsAlerts();
  const { check, acknowledge, unacknowledge } = useAlertActions();
  const [pausing, setPausing] = useState<OpsAlert | null>(null);
  const [days, setDays] = useState("7");

  if (error) {
    return <div className="animate-fade-in"><AdminErrorState icon={BellRing} title="Failed to load alerts" description={error.message} onRetry={() => refetch()} /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Alerts</h1>
          <p className="text-muted-foreground">Problems the monitor has found, checked every {data?.checkEvery ?? "30 minutes"}.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => check.mutate()} disabled={check.isPending}>
          <RefreshCw className={cn("h-4 w-4", check.isPending && "animate-spin")} />Check now
        </Button>
      </div>

      {data && (
        <div className={cn("rounded-lg border p-3 text-sm", data.emailConfigured ? "border-border/30 bg-card/50" : "border-warning/30 bg-warning/5")}>
          {data.emailConfigured
            ? <>Emails go to <strong>{data.emailTo}</strong>. You only get one when something new goes wrong, as a reminder while it stays open (daily for problems, every 3 days for warnings), or when it is fixed.</>
            : <>Email is not set up (no email key on the server), so alerts only appear here.</>}
        </div>
      )}

      {isLoading || !data ? (
        <div className="space-y-3"><div className="h-28 shimmer rounded-xl" /><div className="h-28 shimmer rounded-xl" /></div>
      ) : (
        <>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Open</CardTitle>
              <CardDescription>{data.active.length === 0 ? "Nothing is wrong right now." : `${data.active.length} need${data.active.length === 1 ? "s" : ""} attention`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.active.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />All clear. Checks cover marketing posting, AI credits, channel logins, new admins, and data request deadlines.</div>
              )}
              {data.active.map((a) => (
                <AlertCard key={a.fingerprint} a={a} busy={unacknowledge.isPending}
                  onAck={() => { setDays("7"); setPausing(a); }} onUnack={() => unacknowledge.mutate(a.fingerprint)} />
              ))}
            </CardContent>
          </Card>

          {data.fixed.length > 0 && (
            <Card className="glass-card">
              <CardHeader><CardTitle>Fixed in the last 14 days</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.fixed.map((a) => (
                  <div key={`${a.fingerprint}-${a.resolved_at}`} className="flex flex-wrap items-center gap-x-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>{a.title}</span>
                    <span className="text-xs text-muted-foreground">open {day(a.first_seen_at)}, fixed {ago(a.resolved_at)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ReasonConfirmDialog
        open={!!pausing} onOpenChange={(o) => !o && setPausing(null)}
        title="Pause reminders" description={<>No more emails about <strong>{pausing?.title}</strong> until the pause ends. It stays on this page, and you are told right away if it gets worse. This is written to the audit log.</>}
        reasonLabel="Why is it OK to wait?" reasonPlaceholder="e.g. Instagram is paused on purpose while the account is reviewed"
        confirmLabel="Pause reminders" pending={acknowledge.isPending}
        onConfirm={({ reason }) => pausing && acknowledge.mutate({ fingerprint: pausing.fingerprint, days: Number(days), reason }, { onSuccess: () => setPausing(null) })}
      >
        <div className="space-y-2">
          <Label>Pause for</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 3, 7, 14, 30].map((d) => <SelectItem key={d} value={String(d)}>{d} day{d === 1 ? "" : "s"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </ReasonConfirmDialog>
    </div>
  );
}
