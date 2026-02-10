import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3, Users, TrendingUp, AlertTriangle, Crown, Activity,
} from "lucide-react";
import { useAdminAnalytics } from "@/hooks/admin/useAdminAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export default function Analytics() {
  const { data, isLoading, error, refetch } = useAdminAnalytics();
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState icon={BarChart3} title="Failed to load analytics" description="Please try again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Insights for decision-making</p>
      </div>

      {/* Retention Funnel */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Retention Funnel</CardTitle>
          <CardDescription>How users progress through engagement stages</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 shimmer rounded" />
          ) : data && (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Registered", value: data.retentionFunnel.registered, color: "primary" },
                { label: "Made Transactions", value: data.retentionFunnel.withTransactions, color: "info" },
                { label: "Active (30d)", value: data.retentionFunnel.activeIn30d, color: "purple" },
              ].map((step, i) => (
                <div key={step.label} className="relative">
                  <Card className={cn("border-l-4", `border-l-${step.color}`)}>
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-foreground">{step.value}</p>
                      <p className="text-sm text-muted-foreground">{step.label}</p>
                      {i > 0 && data.retentionFunnel.registered > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round((step.value / data.retentionFunnel.registered) * 100)}% of total
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue + Subscription Lifecycle */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-32 shimmer rounded" /> : data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-primary">{data.revenue.activeSubscriptions}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">Trial Conversion</p>
                    <p className="text-2xl font-bold text-info">{data.revenue.trialConversionRate}%</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Lifecycle Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple" /> Subscription Lifecycle</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-[250px] shimmer rounded" /> : data && (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.subscriptionLifecycle}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Legend />
                  <Bar dataKey="active" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="trialing" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelled" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Churn Risk */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> Churn Risk Users
          </CardTitle>
          <CardDescription>Users who were active but haven't logged in for 14+ days</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-48 shimmer rounded" /> : data && data.churnRiskUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No users at churn risk — great!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Email</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.churnRiskUsers.map((user) => (
                  <TableRow key={user.id} className="border-border/30">
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastActive ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true }) : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "capitalize",
                        user.subscriptionStatus === "active" && "bg-primary/10 text-primary border-primary/20",
                        user.subscriptionStatus === "trialing" && "bg-info/10 text-info border-info/20",
                        user.subscriptionStatus === "cancelled" && "bg-destructive/10 text-destructive border-destructive/20",
                        user.subscriptionStatus === "none" && "bg-muted text-muted-foreground border-border",
                      )}>{user.subscriptionStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/users/${user.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple" /> Top Users by Activity
          </CardTitle>
          <CardDescription>Most active users by transaction count</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-48 shimmer rounded" /> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>#</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.topUsers.map((user, i) => (
                  <TableRow key={user.id} className="border-border/30">
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.transactionCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "capitalize",
                        user.subscriptionStatus === "active" && "bg-primary/10 text-primary border-primary/20",
                        user.subscriptionStatus === "trialing" && "bg-info/10 text-info border-info/20",
                        user.subscriptionStatus === "none" && "bg-muted text-muted-foreground border-border",
                      )}>{user.subscriptionStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/users/${user.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
