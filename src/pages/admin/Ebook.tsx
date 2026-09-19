import { useState } from "react";
import { BookOpen, MailOpen, CheckCircle2, UserMinus, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/admin/StatsCard";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { EbookDailyChart } from "@/components/admin/charts/EbookDailyChart";
import { useAdminEbook } from "@/hooks/admin/useAdminEbook";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

const STAGE_LABELS: Record<number, string> = {
  0: "Book only",
  1: "Email 1 sent",
  2: "Email 2 sent",
  3: "Email 3 sent",
  4: "Email 4 sent",
};

export default function Ebook() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminEbook(days);

  if (isError) {
    return (
      <AdminErrorState
        icon={AlertTriangle}
        title="Failed to load ebook stats"
        description={error instanceof Error ? error.message : "The ebook stats request failed. Check your admin access and try again."}
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ebook Offer</h1>
          <p className="text-sm text-muted-foreground">
            Requests, link opens and email-series progress for the free ebook offer.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              variant="ghost"
              size="sm"
              onClick={() => setDays(r)}
              className={cn(
                "h-7 px-3 text-xs",
                days === r && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {r}d
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Book requests"
              value={data.totals.requests}
              subtitle={`${data.totals.requests_in_window} in the last ${days} days`}
              icon={BookOpen}
              variant="primary"
            />
            <StatsCard
              title="Opened the link"
              value={pct(data.opens.unique_emails, data.totals.requests)}
              subtitle={`${data.opens.unique_emails} unique openers, ${data.opens.total} total clicks`}
              icon={MailOpen}
              variant="info"
            />
            <StatsCard
              title="Finished the series"
              value={pct(data.totals.series_completed, data.totals.series_started)}
              subtitle={`${data.totals.series_completed} of ${data.totals.series_started} who started the email series`}
              icon={CheckCircle2}
              variant="purple"
            />
            <StatsCard
              title="Opted out"
              value={pct(data.totals.unsubscribed, data.totals.requests)}
              subtitle={`${data.totals.unsubscribed} unsubscribed of ${data.totals.requests} requests`}
              icon={UserMinus}
              variant="destructive"
            />
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Requests vs opens — last {days} days</CardTitle>
            </CardHeader>
            <CardContent>
              <EbookDailyChart data={data.daily} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Requests by source</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_source.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No requests yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.by_source.map((row) => (
                      <li key={row.source} className="flex items-center justify-between py-3">
                        <span className="text-sm text-foreground">{row.source || "unknown"}</span>
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {row.requests}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Leads by email-series stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_stage.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No leads yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.by_stage.map((row) => (
                      <li key={row.stage} className="flex items-center justify-between py-3">
                        <span className="text-sm text-foreground">
                          {STAGE_LABELS[row.stage] ?? `Stage ${row.stage}`}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {row.leads}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
