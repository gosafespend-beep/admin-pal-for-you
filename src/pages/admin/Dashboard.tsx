import { type ActivityItem } from "@/components/admin/RecentActivity";
import {
  Users, 
  Receipt, 
  Wallet, 
  CreditCard,
  Target,
  FileText,
  ClipboardList,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Activity,
  TrendingUp,
  Zap,
  DollarSign,
  Repeat,
  PiggyBank,
  BarChart3,
  Landmark
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { TransactionVolumeChart } from "@/components/admin/charts/TransactionVolumeChart";
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart";
import { CategoryDistributionChart } from "@/components/admin/charts/CategoryDistributionChart";
import { QuickStatsGrid } from "@/components/admin/QuickStatsGrid";
import { RecentActivity } from "@/components/admin/RecentActivity";
import { useAdminDashboardStats } from "@/hooks/admin/useAdminDashboardStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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
  const { data: stats, isLoading, error } = useAdminDashboardStats();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[400px]">
        <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Activity className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-destructive font-semibold text-lg">Failed to load dashboard stats</p>
        <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
      </div>
    );
  }

  const savingsProgress = stats?.features.totalSavingsTarget 
    ? (stats.features.totalSavingsProgress / stats.features.totalSavingsTarget) * 100 
    : 0;

  const quickStats = [
    { icon: CreditCard, label: "Accounts", value: formatNumber(stats?.features.totalAccounts || 0), color: "info" as const },
    { icon: FileText, label: "Bills", value: formatNumber(stats?.features.totalBills || 0), color: "warning" as const },
    { icon: TrendingUp, label: "Debts", value: formatNumber(stats?.features.activeDebts || 0), color: "orange" as const },
    { icon: Target, label: "Goals", value: formatNumber(stats?.features.totalSavingsGoals || 0), color: "primary" as const },
    { icon: RefreshCw, label: "Transfers", value: formatNumber(stats?.overview.totalTransfers || 0), color: "purple" as const },
    { icon: Zap, label: "Categories", value: formatNumber(stats?.features.totalCategories || 0), color: "pink" as const },
  ];

  // Map recent activity for the component
  const recentActivityItems = (stats?.recentActivity || []).map((a) => ({
    id: a.id,
    type: a.type as "expense" | "income" | "transfer",
    amount: a.amount,
    description: a.description,
    date: a.date,
    userId: a.userId,
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Platform overview and key metrics for Go Safe Spend
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 px-4 py-2 rounded-lg border border-border/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live data
        </div>
      </div>

      {/* Primary Stats - 4 Column Grid with REAL trends */}
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

      {/* Quick Stats Strip */}
      <QuickStatsGrid stats={quickStats} isLoading={isLoading} />

      {/* New Metrics Row */}
      {!isLoading && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card border-l-4 border-l-info">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                  <Repeat className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.features.activeRecurring}</p>
                  <p className="text-xs text-muted-foreground">Active Recurring ({formatCurrency(stats.features.recurringMonthlyAmount)}/mo)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-purple">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10">
                  <BarChart3 className="h-5 w-5 text-purple" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.features.totalSubscriptions}</p>
                  <p className="text-xs text-muted-foreground">{stats.features.activeTrials} trials • {stats.features.activeSubscriptions} active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <PiggyBank className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stats.features.totalBudgets}</p>
                  <p className="text-xs text-muted-foreground">Active Budgets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-orange">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/10">
                  <Landmark className="h-5 w-5 text-orange" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(stats.features.netWorth)}</p>
                  <p className="text-xs text-muted-foreground">Platform Net Worth</p>
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
        <CategoryDistributionChart 
          data={stats?.charts.topCategories || []} 
          isLoading={isLoading} 
        />
      </div>

      {/* Financial Overview - 3 Column */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Financial Overview</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {isLoading ? (
            <>
              <StatsCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Expenses"
                value={formatCurrency(stats?.overview.totalExpenseAmount || 0)}
                subtitle={`${formatNumber(stats?.overview.totalExpenses || 0)} transactions`}
                icon={ArrowUpRight}
                variant="pink"
                trend={stats?.trends.expenseTrend !== undefined ? { value: Math.abs(stats.trends.expenseTrend), isPositive: stats.trends.expenseTrend <= 0 } : undefined}
              />
              <StatsCard
                title="Total Income"
                value={formatCurrency(stats?.overview.totalIncomeAmount || 0)}
                subtitle={`${formatNumber(stats?.overview.totalIncomes || 0)} transactions`}
                icon={ArrowDownLeft}
                variant="primary"
                trend={stats?.trends.incomeTrend !== undefined ? { value: Math.abs(stats.trends.incomeTrend), isPositive: stats.trends.incomeTrend >= 0 } : undefined}
              />
              <StatsCard
                title="Debt Balance"
                value={formatCurrency(stats?.features.totalDebtBalance || 0)}
                subtitle={`${stats?.features.activeDebts || 0} active debts`}
                icon={TrendingUp}
                variant="orange"
              />
            </>
          )}
        </div>
      </div>

      {/* User Growth Chart */}
      <UserGrowthChart 
        data={stats?.charts.userSignups || []} 
        isLoading={isLoading} 
      />

      {/* Bottom Section - Recent Activity + Savings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Feed */}
        <RecentActivity activities={recentActivityItems} isLoading={isLoading} />

        {/* Savings Progress Card */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>Savings Progress</CardTitle>
            </div>
            <CardDescription>Platform-wide savings goals progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-4 w-full shimmer rounded" />
                <div className="h-4 w-full shimmer rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(stats?.features.totalSavingsProgress || 0)} saved
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(stats?.features.totalSavingsTarget || 0)} goal
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-primary transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(savingsProgress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {savingsProgress.toFixed(1)}% complete
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {stats?.features.completedGoals || 0} goals completed
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{stats?.features.totalSavingsGoals || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Goals</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{stats?.features.completedGoals || 0}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{(stats?.features.totalSavingsGoals || 0) - (stats?.features.completedGoals || 0)}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
