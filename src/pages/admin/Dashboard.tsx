import { type ActivityItem } from "@/components/admin/RecentActivity";
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
  UserCheck,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { TransactionVolumeChart } from "@/components/admin/charts/TransactionVolumeChart";
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart";
import { QuickStatsGrid } from "@/components/admin/QuickStatsGrid";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useAdminDashboardStats } from "@/hooks/admin/useAdminDashboardStats";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { Card, CardContent } from "@/components/ui/card";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  const { data: stats, isLoading, error, refetch } = useAdminDashboardStats();

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

  const recentActivityItems = (stats?.recentActivity || []).map((a) => ({
    id: a.id,
    type: a.type as "expense" | "income" | "transfer",
    amount: a.amount,
    description: a.description,
    date: a.date,
    userId: a.userId,
  }));

  const subscriptionQuickStats = [
    { icon: BarChart3, label: "Subscriptions", value: formatNumber(stats?.subscriptions.total || 0), color: "primary" as const },
    { icon: Zap, label: "Active", value: formatNumber(stats?.subscriptions.active || 0), color: "primary" as const },
    { icon: Clock, label: "Trialing", value: formatNumber(stats?.subscriptions.trialing || 0), color: "info" as const },
    { icon: XCircle, label: "Cancelled", value: formatNumber(stats?.subscriptions.cancelled || 0), color: "destructive" as const },
    { icon: TrendingUp, label: "Conversion", value: `${stats?.subscriptions.trialConversionRate || 0}%`, color: "purple" as const },
    { icon: CalendarDays, label: "New This Week", value: formatNumber(stats?.engagement.newSignupsThisWeek || 0), color: "warning" as const },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and key metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 px-4 py-2 rounded-lg border border-border/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live data
          </div>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              title="Total Users"
              value={formatNumber(stats?.overview.totalUsers || 0)}
              subtitle="Registered users"
              icon={Users}
              variant="primary"
              trend={stats?.trends.userTrend !== undefined ? { value: Math.abs(stats.trends.userTrend), isPositive: stats.trends.userTrend >= 0 } : undefined}
            />
            <StatsCard
              title="Total Transactions"
              value={formatNumber(stats?.overview.totalTransactions || 0)}
              subtitle={`${formatCompact(stats?.overview.totalExpenses || 0)} expenses • ${formatCompact(stats?.overview.totalIncomes || 0)} incomes`}
              icon={Receipt}
              variant="info"
            />
            <StatsCard
              title="Platform Volume"
              value={formatCurrency(stats?.overview.platformVolume || 0)}
              subtitle="Total money tracked"
              icon={Wallet}
              variant="purple"
            />
            <StatsCard
              title="Waitlist"
              value={formatNumber(stats?.overview.waitlistCount || 0)}
              subtitle="Pending signups"
              icon={ClipboardList}
              variant="warning"
            />
          </>
        )}
      </div>

      {/* Subscription & Engagement Quick Stats */}
      <QuickStatsGrid stats={subscriptionQuickStats} isLoading={isLoading} />

      {/* Engagement Metrics Row */}
      {!isLoading && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.engagement.activeUsers7d}</p>
                  <p className="text-xs text-muted-foreground">Active (7 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-info">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                  <Users className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.engagement.activeUsers30d}</p>
                  <p className="text-xs text-muted-foreground">Active (30 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-purple">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10">
                  <Receipt className="h-5 w-5 text-purple" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.engagement.avgTransactionsPerUser}</p>
                  <p className="text-xs text-muted-foreground">Avg txns/user</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                  <Zap className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.subscriptions.active}</p>
                  <p className="text-xs text-muted-foreground">Active Subscriptions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TransactionVolumeChart 
          data={stats?.charts.monthlyData || []} 
          isLoading={isLoading} 
        />
        <UserGrowthChart 
          data={stats?.charts.userSignups || []} 
          isLoading={isLoading} 
        />
      </div>

      {/* Recent Activity */}
      <RecentActivity activities={recentActivityItems} isLoading={isLoading} />
    </div>
  );
}
