import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Info, RefreshCw, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdminGrowth } from "@/hooks/admin/useAdminGrowth";
import { funnelSteps, headline, retentionRate } from "@/lib/growth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const GRID = "hsl(217 33% 17%)";
const TICK = { fill: "hsl(215 20% 55%)", fontSize: 11 };

export default function Growth() {
  const [weeks, setWeeks] = useState(12);
  const { data, isLoading, error, refetch, isFetching } = useAdminGrowth(weeks);

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState icon={TrendingUp} title="Failed to load growth metrics" description={error.message} onRetry={() => refetch()} />
      </div>
    );
  }

  const steps = data ? funnelSteps(data.funnel) : [];
  const note = data ? headline(data.funnel) : null;
  const cov = data?.coverage;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Growth</h1>
          <p className="text-muted-foreground">
            From sign-up to paying, counted in people. Cohorts are the weeks people signed up in.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
            <SelectTrigger className="w-[150px] bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Last 4 weeks</SelectItem>
              <SelectItem value="12">Last 12 weeks</SelectItem>
              <SelectItem value="26">Last 26 weeks</SelectItem>
              <SelectItem value="52">Last 52 weeks</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 shimmer rounded-xl" />)}</div>
      ) : (
        <>
          {note && (
            <Card className="glass-card border-l-4 border-l-warning">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p className="text-sm text-foreground">{note}</p>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card">
            <CardContent className="flex items-start gap-3 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />
              <p className="text-sm text-muted-foreground">
                Of {cov!.users} people who signed up in this window, {cov!.tracked} have any tracked app activity
                {cov!.firstEvent ? ` (tracking began ${format(new Date(cov!.firstEvent), "MMM d, yyyy")})` : ""} and{" "}
                {cov!.withAcquisition} have a recorded acquisition source. Steps marked "app events" only cover people the app tracked;
                steps marked "database" are exact.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Sign-up to paying</CardTitle>
                <CardDescription>Share of everyone who signed up in the window</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {steps.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {s.count} · {s.ofSignups ?? 0}%
                        <Badge variant="secondary" className="ml-2 text-[10px]">{s.source}</Badge>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, s.ofSignups ?? 0)}%` }} />
                    </div>
                  </div>
                ))}
                {data.medianHoursToFirstTransaction !== null && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    Median time from sign-up to first transaction: {data.medianHoursToFirstTransaction >= 48
                      ? `${Math.round(data.medianHoursToFirstTransaction / 24)} days`
                      : `${data.medianHoursToFirstTransaction} hours`}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Come back after signing up</CardTitle>
                <CardDescription>Active (any app event, expense or income) at least N days after signing up</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["d1", "d7", "d30"] as const).map((k) => {
                  const r = data.retention[k];
                  const { rate, enough } = retentionRate(r);
                  return (
                    <div key={k} className="flex items-center justify-between rounded-lg border border-border/30 bg-card/50 p-3">
                      <span className="text-sm font-medium">Day {k.slice(1)}</span>
                      <span className="text-sm text-muted-foreground">
                        {r.retained} of {r.eligible} ·{" "}
                        <span className="font-semibold text-foreground">{enough && rate !== null ? `${rate}%` : "too few to judge"}</span>
                      </span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">Only people who signed up at least N days ago are counted.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Sign-ups and activation by week</CardTitle>
              <CardDescription>People who signed up that week, and how many of them have logged a transaction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekly.map((w) => ({ ...w, label: format(new Date(w.week), "MMM d") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 12 }} />
                    <Legend />
                    <Bar dataKey="signups" name="Signed up" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="setUp" name="Set up an account" fill="hsl(199 89% 48%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="activated" name="Logged a transaction" fill="hsl(340 82% 62%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle>By app</CardTitle>
                <CardDescription>People with tracked activity on each platform (someone can be on both)</CardDescription>
              </CardHeader>
              <CardContent>
                {data.byPlatform.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No tracked activity in this window.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead>App</TableHead><TableHead className="text-right">People</TableHead>
                        <TableHead className="text-right">Onboarded</TableHead><TableHead className="text-right">Transacting</TableHead>
                        <TableHead className="text-right">Saw paywall</TableHead><TableHead className="text-right">Paying</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byPlatform.map((p) => (
                        <TableRow key={p.platform} className="border-border/30">
                          <TableCell className="font-medium capitalize">{p.platform}</TableCell>
                          <TableCell className="text-right">{p.users}</TableCell>
                          <TableCell className="text-right">{p.onboarded}</TableCell>
                          <TableCell className="text-right">{p.activated}</TableCell>
                          <TableCell className="text-right">{p.sawPaywall}</TableCell>
                          <TableCell className="text-right">{p.paid}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardHeader>
                <CardTitle>Where people came from</CardTitle>
                <CardDescription>Acquisition source recorded on the account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Source</TableHead><TableHead className="text-right">People</TableHead>
                      <TableHead className="text-right">Transacting</TableHead><TableHead className="text-right">Paying</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.acquisition.map((a) => (
                      <TableRow key={a.source} className="border-border/30">
                        <TableCell className="font-medium">{a.source}</TableCell>
                        <TableCell className="text-right">{a.users}</TableCell>
                        <TableCell className="text-right">{a.activated}</TableCell>
                        <TableCell className="text-right">{a.paid}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {cov!.withAcquisition === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No account has a recorded source, so channels can't be compared yet. The fields exist on the profile but the apps aren't writing them.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
