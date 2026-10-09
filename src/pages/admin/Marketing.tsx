import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Info, Megaphone, RefreshCw, XCircle } from "lucide-react";
import { useMarketingOverview } from "@/hooks/admin/useAdminMarketing";
import { assessMarketing, classifyError, type Finding, type MarketingOverview, type Severity } from "../../../supabase/functions/_shared/marketingRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const SEVERITY: Record<Severity, { icon: typeof Info; tone: string }> = {
  problem: { icon: XCircle, tone: "text-destructive" },
  warning: { icon: AlertTriangle, tone: "text-warning" },
  info: { icon: Info, tone: "text-info" },
  ok: { icon: CheckCircle2, tone: "text-primary" },
};

const day = (iso: string | null | undefined) => (iso ? format(new Date(iso), "MMM d, yyyy") : "—");
const ago = (iso: string | null | undefined) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never");
const usd = (n: number) => `$${n.toFixed(2)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <Card className="glass-card"><CardContent className="p-4">
      <p className={cn("text-2xl font-bold", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

function OverviewTab({ o, findings }: { o: MarketingOverview; findings: Finding[] }) {
  const lastPost = o.publishing.lastPublishedAt;
  const stalled = !lastPost || Date.now() - new Date(lastPost).getTime() > 3 * 86_400_000;
  const stuck = o.queue.byStatus.filter((s) => s.status === "drafted" || s.status === "approved").reduce((n, s) => n + s.count, 0);
  const spend30 = o.spend.agents.reduce((n, a) => n + a.cost30d, 0);
  const maxDay = Math.max(0.01, ...o.spend.daily.map((d) => d.cost));

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>What needs attention</CardTitle>
          <CardDescription>Worked out from the agent run log, the last post on each channel, and login expiry dates</CardDescription>
        </CardHeader>
        <CardContent><ul className="space-y-3">{findings.map((f) => <FindingRow key={f.id} f={f} />)}</ul></CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Last post" value={ago(lastPost)} sub={lastPost ? day(lastPost) : undefined} tone={stalled ? "text-destructive" : undefined} />
        <Stat label="Runs in the last 24 hours" value={<>{o.runs.last24h.ok} <span className="text-base font-normal text-muted-foreground">ok</span> · <span className={o.runs.last24h.failed > 0 ? "text-destructive" : ""}>{o.runs.last24h.failed}</span> <span className="text-base font-normal text-muted-foreground">failed</span></>} sub={`Last success ${ago(o.runs.lastSuccessAt)}`} />
        <Stat label="AI spend, last 30 days" value={usd(spend30)} sub="Failed runs cost nothing" />
        <Stat label="Posts waiting in the queue" value={stuck} sub={`${o.queue.reviewsPending} awaiting your review`} tone={stuck > 0 ? "text-warning" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle>Posts by channel</CardTitle><CardDescription>Published posts, last 30 days and most recent</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">30 days</TableHead><TableHead>Last post</TableHead></TableRow></TableHeader>
              <TableBody>
                {o.publishing.byChannel.map((c) => (
                  <TableRow key={c.channel}><TableCell className="capitalize">{c.channel}</TableCell><TableCell className="text-right">{c.published30d}</TableCell><TableCell>{ago(c.last)}</TableCell></TableRow>
                ))}
                {o.publishing.byChannel.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Nothing published yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Post queue</CardTitle><CardDescription>Every post the system has ever created, by status</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Posts</TableHead><TableHead>Oldest</TableHead></TableRow></TableHeader>
              <TableBody>
                {o.queue.byStatus.map((s) => (
                  <TableRow key={s.status}><TableCell className="capitalize">{s.status}</TableCell><TableCell className="text-right">{s.count}</TableCell><TableCell>{day(s.oldest)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>AI cost per day</CardTitle><CardDescription>Last 14 days. Days with failures but no cost are runs the AI provider refused.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-1" role="img" aria-label={`AI cost per day over the last ${o.spend.daily.length} days`}>
            {o.spend.daily.map((d) => (
              <div key={d.day} className="group flex-1" title={`${day(d.day)}: ${usd(d.cost)}, ${d.runs} runs, ${d.failed} failed`}>
                <div className={cn("w-full rounded-t", d.failed > 0 && d.cost === 0 ? "bg-destructive/60" : "bg-primary/70")} style={{ height: `${Math.max(4, (d.cost / maxDay) * 100)}%` }} />
              </div>
            ))}
            {o.spend.daily.length === 0 && <p className="text-sm text-muted-foreground">No runs in the last 14 days.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Best recent posts</CardTitle><CardDescription>Last 30 days, by engagement rate</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {o.topPosts.map((p, i) => (
            <div key={i} className="rounded-lg border border-border/30 bg-card/50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="capitalize">{p.channel}</Badge>{p.format && <span>{p.format}</span>}<span>{day(p.postedAt)}</span>
                <span className="ml-auto">{p.views} views · {p.reach ?? "—"} reach · {((p.engagementRate ?? 0) * 100).toFixed(1)}% engaged</span>
              </div>
              <p className="text-sm break-words">{p.caption}</p>
            </div>
          ))}
          {o.topPosts.length === 0 && <p className="text-sm text-muted-foreground">No posts with measured views in the last 30 days.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentsTab({ o }: { o: MarketingOverview }) {
  return (
    <div className="space-y-4">
      {o.runs.failing.length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>What is failing</CardTitle><CardDescription>Failed runs in the last 7 days, grouped by agent and task</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Task</TableHead><TableHead className="text-right">Failures</TableHead><TableHead>Cause</TableHead><TableHead>Last worked</TableHead></TableRow></TableHeader>
              <TableBody>
                {o.runs.failing.map((f) => (
                  <TableRow key={`${f.agent}-${f.action}`}>
                    <TableCell className="font-medium">{f.agent}</TableCell>
                    <TableCell>{f.action}</TableCell>
                    <TableCell className="text-right">{f.failures}</TableCell>
                    <TableCell className="max-w-[24rem]">
                      <Badge variant="outline" className="mr-2">{cap(classifyError(f.lastError).replace("_", " "))}</Badge>
                      <span className="text-xs text-muted-foreground break-words">{f.lastError}</span>
                    </TableCell>
                    <TableCell>{ago(f.lastSuccessAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle>Agents</CardTitle><CardDescription>"Shadow" agents run without publishing. Cost is for the last 30 days; the cap is per day.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Runs</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Today / cap</TableHead><TableHead>Last run</TableHead></TableRow></TableHeader>
            <TableBody>
              {o.spend.agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><span className="font-medium">{a.codename}</span> <span className="text-xs text-muted-foreground">{a.id}</span></TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "secondary" : "outline"} className="capitalize">{a.status}</Badge></TableCell>
                  <TableCell className="text-right">{a.runs30d}</TableCell>
                  <TableCell className={cn("text-right", a.failed30d > 0 && "text-destructive")}>{a.failed30d}</TableCell>
                  <TableCell className="text-right">{usd(a.cost30d)}</TableCell>
                  <TableCell className="text-right">{usd(a.costToday)}{a.capUsdDay ? ` / ${usd(a.capUsdDay)}` : ""}</TableCell>
                  <TableCell>{ago(a.lastRunAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelsTab({ o }: { o: MarketingOverview }) {
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader><CardTitle>Channels</CardTitle><CardDescription>Connection health is checked once a day. Login tokens are never shown, only when they expire.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Health</TableHead><TableHead>Login expires</TableHead><TableHead>Login renewed</TableHead></TableRow></TableHeader>
            <TableBody>
              {o.channels.map((c) => {
                const left = c.tokenExpiresAt ? Math.floor((new Date(c.tokenExpiresAt).getTime() - Date.now()) / 86_400_000) : null;
                return (
                  <TableRow key={c.platform}>
                    <TableCell><span className="font-medium capitalize">{c.platform}</span> <span className="text-xs text-muted-foreground">{c.handle}</span></TableCell>
                    <TableCell>{c.enabled ? <Badge variant="secondary">On</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                    <TableCell>{c.healthOk === null ? <span className="text-muted-foreground">—</span> : c.healthOk ? <span className="text-primary">OK</span> : <span className="text-destructive">{c.healthDetail || "Failing"}</span>}{c.checkedAt && <span className="ml-2 text-xs text-muted-foreground">{ago(c.checkedAt)}</span>}</TableCell>
                    <TableCell className={cn(left !== null && left < 7 && "font-medium text-destructive")}>{c.tokenExpiresAt ? `${day(c.tokenExpiresAt)} (${left! < 0 ? "expired" : `${left}d`})` : "No expiry"}</TableCell>
                    <TableCell>{c.tokenUpdatedAt ? day(c.tokenUpdatedAt) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Scheduled jobs</CardTitle>
          <CardDescription>"Succeeded" here only means the job's call was sent. It says nothing about whether the work worked; use the agent runs for that.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Job</TableHead><TableHead>Runs</TableHead><TableHead>Calls</TableHead><TableHead>Last sent</TableHead></TableRow></TableHeader>
            <TableBody>
              {o.jobs.map((j) => (
                <TableRow key={j.name}>
                  <TableCell className="font-medium">{j.name}{!j.active && <Badge variant="outline" className="ml-2">Off</Badge>}</TableCell>
                  <TableCell><code className="text-xs">{j.schedule}</code></TableCell>
                  <TableCell className="text-muted-foreground">{j.target}</TableCell>
                  <TableCell>{ago(j.lastRunAt)} <span className="text-xs text-muted-foreground">{j.lastStatus}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Settings</CardTitle><CardDescription>Read-only for now. Secrets are left out.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Setting</TableHead><TableHead>Value</TableHead><TableHead>Changed</TableHead></TableRow></TableHeader>
            <TableBody>
              {o.flags.map((f) => (
                <TableRow key={f.key}><TableCell className="font-medium">{f.key}</TableCell><TableCell className="max-w-[28rem] truncate text-muted-foreground" title={f.value}>{f.value || "—"}</TableCell><TableCell>{day(f.updatedAt)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Marketing() {
  const { data: o, isLoading, error, refetch, isFetching } = useMarketingOverview();
  const findings = useMemo(() => (o ? assessMarketing(o) : []), [o]);

  if (error) {
    return <div className="animate-fade-in"><AdminErrorState icon={Megaphone} title="Failed to load the marketing report" description={error.message} onRetry={() => refetch()} /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Marketing</h1>
          <p className="text-muted-foreground">The automated posting system: is it running, what it costs, and whether its logins are healthy.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />Refresh
        </Button>
      </div>

      {isLoading || !o ? (
        <div className="space-y-4"><div className="h-40 shimmer rounded-xl" /><div className="h-64 shimmer rounded-xl" /></div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">Overview</TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-background">Agents &amp; spend</TabsTrigger>
            <TabsTrigger value="channels" className="data-[state=active]:bg-background">Channels &amp; jobs</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab o={o} findings={findings} /></TabsContent>
          <TabsContent value="agents"><AgentsTab o={o} /></TabsContent>
          <TabsContent value="channels"><ChannelsTab o={o} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
