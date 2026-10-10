import { format, formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, CheckCircle2, HelpCircle, Info, RefreshCw, XCircle } from "lucide-react";
import { useSystemHealthReport } from "@/hooks/admin/useAdminHealth";
import type { Finding, ServiceCheck, Severity } from "../../../supabase/functions/_shared/healthRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const SEVERITY: Record<Severity, { icon: typeof Info; tone: string }> = {
  problem: { icon: XCircle, tone: "text-destructive" },
  warning: { icon: AlertTriangle, tone: "text-warning" },
  info: { icon: Info, tone: "text-info" },
  ok: { icon: CheckCircle2, tone: "text-primary" },
};

const STATUS: Record<ServiceCheck["status"], { icon: typeof Info; tone: string; label: string }> = {
  ok: { icon: CheckCircle2, tone: "text-primary", label: "Working" },
  warning: { icon: AlertTriangle, tone: "text-warning", label: "Problem" },
  problem: { icon: XCircle, tone: "text-destructive", label: "Not working" },
  unknown: { icon: HelpCircle, tone: "text-muted-foreground", label: "Reachable" },
};

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never");
const day = (iso: string | null) => (iso ? format(new Date(iso), "MMM d, yyyy") : "—");
const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(0)} MB`;

function FindingRow({ f }: { f: Finding }) {
  const { icon: Icon, tone } = SEVERITY[f.severity];
  return (
    <li className="flex gap-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{f.title}</p>
        <p className="text-xs text-muted-foreground break-words">{f.detail}</p>
      </div>
    </li>
  );
}

export default function SystemHealth() {
  const { data, isLoading, error, refetch, isFetching } = useSystemHealthReport();

  if (error) {
    return <div className="animate-fade-in"><AdminErrorState icon={Activity} title="Failed to check system health" description={error.message} onRetry={() => refetch()} /></div>;
  }

  const r = data?.report;
  const f = r?.signals.freshness;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System health</h1>
          <p className="text-muted-foreground">Whether the services behind SafeSpend answer, and whether scheduled work is happening.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />Check again
        </Button>
      </div>

      {isLoading || !data || !r ? (
        <div className="space-y-4"><div className="h-32 shimmer rounded-xl" /><div className="h-64 shimmer rounded-xl" /></div>
      ) : (
        <>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>What needs attention</CardTitle>
              <CardDescription>Checked just now. The same checks run every 30 minutes and email you when something new is wrong.</CardDescription>
            </CardHeader>
            <CardContent><ul className="space-y-3">{data.findings.map((x) => <FindingRow key={x.id} f={x} />)}</ul></CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Services</CardTitle><CardDescription>Each one is asked a simple question right now</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Answered in</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.services.map((s) => {
                    const { icon: Icon, tone, label } = STATUS[s.status];
                    return (
                      <TableRow key={s.key}>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell><span className={cn("inline-flex items-center gap-1.5", tone)}><Icon className="h-4 w-4" />{label}</span></TableCell>
                        <TableCell className="text-right">{s.latencyMs === null ? "—" : `${s.latencyMs} ms`}</TableCell>
                        <TableCell className="max-w-[28rem] text-xs text-muted-foreground">{s.detail || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>When things last happened</CardTitle><CardDescription>For you to judge. With few users, quiet stretches are normal.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {([
                      ["Exchange rates refreshed", f!.fxRatesAt, "Daily"],
                      ["App activity event", f!.lastEventAt, ""],
                      ["Sign-up", f!.lastSignupAt, ""],
                      ["App store purchase event", f!.lastStoreEventAt, ""],
                      ["Paystack subscription update", f!.lastPaystackUpdateAt, ""],
                    ] as const).map(([label, at, note]) => (
                      <TableRow key={label}>
                        <TableCell>{label}{note && <span className="ml-2 text-xs text-muted-foreground">{note}</span>}</TableCell>
                        <TableCell className="text-right">{ago(at)}<span className="ml-2 text-xs text-muted-foreground">{day(at)}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Database</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div><p className="text-2xl font-bold">{mb(r.signals.db.sizeBytes)}</p><p className="text-xs text-muted-foreground">Size</p></div>
                <div><p className="text-2xl font-bold">{r.signals.db.connections} <span className="text-base font-normal text-muted-foreground">/ {r.signals.db.maxConnections}</span></p><p className="text-xs text-muted-foreground">Connections in use</p></div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Scheduled jobs</CardTitle>
              <CardDescription>
                A job shows "succeeded" once its call is sent, so the real test is what came back.
                {r.signals.http.since ? ` Covers ${r.signals.http.total} calls since ${format(new Date(r.signals.http.since), "MMM d, HH:mm")}.` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {r.signals.cron.failed24h.length === 0 && r.signals.http.failures.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />No scheduled call failed in the period covered.</p>
              )}
              {r.signals.cron.failed24h.map((c) => (
                <p key={c.job} className="text-sm"><span className="font-medium">{c.job}</span> failed {c.failures} time{c.failures === 1 ? "" : "s"} in the last day <span className="text-xs text-muted-foreground">{c.message}</span></p>
              ))}
              {r.signals.http.failures.map((h) => (
                <p key={h.status} className="text-sm"><span className="font-medium">{h.count} call{h.count === 1 ? "" : "s"} answered {h.status}</span> <span className="text-xs text-muted-foreground break-words">{h.sample}</span></p>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
