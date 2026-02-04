import { 
  Users, 
  Receipt, 
  Wallet, 
  TrendingUp, 
  CreditCard,
  Target,
  FileText,
  ClipboardList,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useAdminStats();

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Failed to load dashboard stats</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
              value={formatNumber(stats?.totalUsers || 0)}
              subtitle="Registered profiles"
              icon={Users}
            />
            <StatsCard
              title="Total Transactions"
              value={formatNumber((stats?.totalExpenses || 0) + (stats?.totalIncomes || 0) + (stats?.totalTransfers || 0))}
              subtitle="Expenses + Incomes + Transfers"
              icon={Receipt}
            />
            <StatsCard
              title="Platform Volume"
              value={formatCurrency((stats?.totalExpenseAmount || 0) + (stats?.totalIncomeAmount || 0))}
              subtitle="Total money tracked"
              icon={Wallet}
            />
            <StatsCard
              title="Waitlist"
              value={formatNumber(stats?.waitlistCount || 0)}
              subtitle="Pending signups"
              icon={ClipboardList}
            />
          </>
        )}
      </div>

      {/* Financial Breakdown */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Financial Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                value={formatCurrency(stats?.totalExpenseAmount || 0)}
                subtitle={`${formatNumber(stats?.totalExpenses || 0)} transactions`}
                icon={ArrowUpRight}
              />
              <StatsCard
                title="Total Income"
                value={formatCurrency(stats?.totalIncomeAmount || 0)}
                subtitle={`${formatNumber(stats?.totalIncomes || 0)} transactions`}
                icon={ArrowDownLeft}
              />
              <StatsCard
                title="Transfers"
                value={formatNumber(stats?.totalTransfers || 0)}
                subtitle="Between accounts"
                icon={RefreshCw}
              />
            </>
          )}
        </div>
      </div>

      {/* Platform Features */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Platform Features</h2>
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
                value={formatNumber(stats?.totalAccounts || 0)}
                subtitle="User accounts"
                icon={CreditCard}
              />
              <StatsCard
                title="Bills"
                value={formatNumber(stats?.totalBills || 0)}
                subtitle="Recurring bills"
                icon={FileText}
              />
              <StatsCard
                title="Debts"
                value={formatNumber(stats?.totalDebts || 0)}
                subtitle="Active debts"
                icon={TrendingUp}
              />
              <StatsCard
                title="Savings Goals"
                value={formatNumber(stats?.totalSavingsGoals || 0)}
                subtitle="Active goals"
                icon={Target}
              />
            </>
          )}
        </div>
      </div>

      {/* Quick Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Summary</CardTitle>
          <CardDescription>
            Quick overview of your Go Safe Spend platform
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
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Your platform is tracking <strong className="text-foreground">{formatCurrency(stats?.totalExpenseAmount || 0)}</strong> in expenses
                  and <strong className="text-foreground">{formatCurrency(stats?.totalIncomeAmount || 0)}</strong> in income
                  across <strong className="text-foreground">{stats?.totalUsers || 0}</strong> users.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Users have created <strong className="text-foreground">{stats?.totalAccounts || 0}</strong> accounts,
                  set up <strong className="text-foreground">{stats?.totalBills || 0}</strong> recurring bills,
                  and are working towards <strong className="text-foreground">{stats?.totalSavingsGoals || 0}</strong> savings goals.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
