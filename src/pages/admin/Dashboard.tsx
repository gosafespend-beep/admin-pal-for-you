import { format } from "date-fns";
import {
  Users,
  Receipt,
  Wallet,
  ClipboardList,
  Activity,
  TrendingUp,
  Zap,
  Clock,
  XCircle,
  CalendarDays,
  CircleSlash,
  RefreshCw,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { TransactionVolumeChart } from "@/components/admin/charts/TransactionVolumeChart";
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart";
import { QuickStatsGrid } from "@/components/admin/QuickStatsGrid";
import { RecentActivity, type ActivityItem } from "@/components/admin/RecentActivity";
import { NeedsAttention } from "@/components/admin/NeedsAttention";
import { useAdminDashboardStats } from "@/hooks/admin/useAdminDashboardStats";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { endedTrials, signupsLine } from "@/lib/shell";
import { cn } from "@/lib/utils";

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatCompact(num: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

function StatsCardSkeleton() {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-20 shimmer rounded" />
            <div className="h-8 w-24 shimmer rounded" />
            <div className="h-3 w-16 shimmer rounded" />
          </div>
          <div className="h-14 w-14 rounded-2xl shimmer" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error, refetch, isFetching, dataUpdatedAt } = useAdminDashboardStats();

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState
          icon={Activity}
          title="Failed to load dashboard stats"
          description="Please check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const recentActivityItems: ActivityItem[] = (stats?.recentActivity || []).map((a) => ({
    id: a.id,
    type: a.type as "expense" | "income" | "transfer",
    amount: a.amount,
    description: a.description,
    date: a.date,
    userId: a.userId,
  }));

  const sub = stats?.subscriptions;
  const ended = sub ? endedTrials(sub) : 0;
  const signups = stats?.trends.signupsThisMonth !== undefined && stats?.trends.signupsLastMonth !== undefined
    ? signupsLine(stats.trends.signupsThisMonth, stats.trends.signupsLastMonth)
    : "Registered users";

  // Every subscription is accounted for: active + trialing + ended trials + cancelled = the total.
  const subscriptionQuickStats = [
    { icon: Zap, label: "Paying", value: formatNumber(sub?.active || 0), color: "primary" as const },
    { icon: Clock, label: "On trial", value: formatNumber(sub?.trialing || 0), color: "info" as const },
    { icon: CircleSlash, label: "Trial ended, not subscribed", value: formatNumber(ended), color: "orange" as const },
    { icon: XCircle, label: "Cancelled", value: formatNumber(sub?.cancelled || 0), color: "destructive" as const },
    {
      icon: TrendingUp,
      label: "Trial to paid",
      // A percentage of a handful of outcomes is noise, so say so instead.
      value: (sub?.conversionSample ?? 0) >= 10 ? `${sub?.trialConversionRate || 0}%` : "Too few yet",
      color: "purple" as const,
    },
    { icon: CalendarDays, label: "New this week", value: formatNumber(stats?.engagement.newSignupsThisWeek || 0), color: "warning" as const },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <NeedsAttention />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">How SafeSpend is doing</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {dataUpdatedAt > 0 && <span>Updated {format(new Date(dataUpdatedAt), "HH:mm")}</span>}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <section aria-label="Key numbers" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Total users"
              value={formatNumber(stats?.overview.totalUsers || 0)}
              subtitle={signups}
              icon={Users}
              variant="primary"
            />
            <StatsCard
              title="Active, last 30 days"
              value={formatNumber(stats?.engagement.activeUsers30d || 0)}
              subtitle={`${formatNumber(stats?.engagement.activeUsers7d || 0)} in the last 7 days`}
              icon={Wallet}
              variant="purple"
            />
            <StatsCard
              title="Transactions logged"
              value={formatNumber(stats?.overview.totalTransactions || 0)}
              subtitle={`${formatCompact(stats?.overview.totalExpenses || 0)} expenses, ${formatCompact(stats?.overview.totalIncomes || 0)} incomes, ${stats?.engagement.avgTransactionsPerUser ?? 0} per user`}
              icon={Receipt}
              variant="info"
            />
            <StatsCard
              title="Waitlist and newsletter"
              value={formatNumber(stats?.overview.waitlistCount || 0)}
              subtitle="Signed up before launch"
              icon={ClipboardList}
              variant="warning"
            />
          </>
        )}
      </section>

      <section aria-label="Subscriptions">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Subscriptions ({formatNumber(sub?.total || 0)} in all)</h2>
        <QuickStatsGrid stats={subscriptionQuickStats} isLoading={isLoading} />
      </section>

      <section aria-label="Trends" className="grid gap-6 lg:grid-cols-2">
        <TransactionVolumeChart
          data={(stats?.charts.monthlyData || []).map((m) => ({ label: m.label, expenses: m.expenseCount, income: m.incomeCount }))}
          isLoading={isLoading}
        />
        <UserGrowthChart
          data={stats?.charts.userSignups || []}
          isLoading={isLoading}
        />
      </section>

      <RecentActivity activities={recentActivityItems} isLoading={isLoading} />
    </div>
  );
}
