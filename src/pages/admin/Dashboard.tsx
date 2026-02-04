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
  TrendingUp,
  Activity
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { TransactionVolumeChart } from "@/components/admin/charts/TransactionVolumeChart";
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart";
import { CategoryDistributionChart } from "@/components/admin/charts/CategoryDistributionChart";
import { useAdminDashboardStats } from "@/hooks/admin/useAdminDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

function StatsCardSkeleton() {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useAdminDashboardStats();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Activity className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-destructive font-medium">Failed to load dashboard stats</p>
        <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
      </div>
    );
  }

  const savingsProgress = stats?.features.totalSavingsTarget 
    ? (stats.features.totalSavingsProgress / stats.features.totalSavingsTarget) * 100 
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and key metrics for Go Safe Spend
        </p>
      </div>

      {/* Primary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            />
            <StatsCard
              title="Total Transactions"
              value={formatNumber(stats?.overview.totalTransactions || 0)}
              subtitle={`${formatNumber(stats?.overview.totalExpenses || 0)} expenses • ${formatNumber(stats?.overview.totalIncomes || 0)} incomes`}
              icon={Receipt}
            />
            <StatsCard
              title="Platform Volume"
              value={formatCurrency(stats?.overview.platformVolume || 0)}
              subtitle="Total money tracked"
              icon={Wallet}
              variant="success"
            />
            <StatsCard
              title="Waitlist"
              value={formatNumber(stats?.overview.waitlistCount || 0)}
              subtitle="Pending signups"
              icon={ClipboardList}
            />
          </>
        )}
      </div>

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

      {/* Financial Breakdown */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Financial Overview</h2>
        <div className="grid gap-4 md:grid-cols-3">
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
              />
              <StatsCard
                title="Total Income"
                value={formatCurrency(stats?.overview.totalIncomeAmount || 0)}
                subtitle={`${formatNumber(stats?.overview.totalIncomes || 0)} transactions`}
                icon={ArrowDownLeft}
                variant="success"
              />
              <StatsCard
                title="Transfers"
                value={formatNumber(stats?.overview.totalTransfers || 0)}
                subtitle="Between accounts"
                icon={RefreshCw}
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

      {/* Platform Features */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Platform Features</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                title="Accounts"
                value={formatNumber(stats?.features.totalAccounts || 0)}
                subtitle="User accounts"
                icon={CreditCard}
              />
              <StatsCard
                title="Bills"
                value={formatNumber(stats?.features.totalBills || 0)}
                subtitle={`${stats?.features.activeBills || 0} active`}
                icon={FileText}
              />
              <StatsCard
                title="Debts"
                value={formatCurrency(stats?.features.totalDebtBalance || 0)}
                subtitle={`${stats?.features.activeDebts || 0} active debts`}
                icon={TrendingUp}
              />
              <StatsCard
                title="Savings Goals"
                value={formatNumber(stats?.features.totalSavingsGoals || 0)}
                subtitle={`${stats?.features.completedGoals || 0} completed`}
                icon={Target}
                variant="success"
              />
            </>
          )}
        </div>
      </div>

      {/* Savings Progress & Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Savings Progress</CardTitle>
            <CardDescription>
              Platform-wide savings goals progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(stats?.features.totalSavingsProgress || 0)} saved
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(stats?.features.totalSavingsTarget || 0)} goal
                  </span>
                </div>
                <Progress value={savingsProgress} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {savingsProgress.toFixed(1)}% of total savings goals achieved
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Platform Summary</CardTitle>
            <CardDescription>
              Quick overview of Go Safe Spend
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Your platform is tracking <span className="font-medium text-foreground">{formatCurrency(stats?.overview.totalExpenseAmount || 0)}</span> in expenses
                  and <span className="font-medium text-foreground">{formatCurrency(stats?.overview.totalIncomeAmount || 0)}</span> in income
                  across <span className="font-medium text-foreground">{stats?.overview.totalUsers || 0}</span> users.
                </p>
                <p>
                  Users have created <span className="font-medium text-foreground">{stats?.features.totalAccounts || 0}</span> accounts,
                  set up <span className="font-medium text-foreground">{stats?.features.totalBills || 0}</span> recurring bills,
                  and are working towards <span className="font-medium text-foreground">{stats?.features.totalSavingsGoals || 0}</span> savings goals.
                </p>
                <p>
                  Total categories in use: <span className="font-medium text-foreground">{stats?.features.totalCategories || 0}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
