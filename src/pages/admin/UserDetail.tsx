import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  Clock,
  Shield,
  Crown,
  Ban,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Target,
  MoreVertical,
  RefreshCw,
  FileText,
  Repeat,
  BarChart3,
  Landmark,
} from "lucide-react";
import { useAdminUserDetail, useAdminUserActions, type UserAction } from "@/hooks/admin/useAdminUserDetail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 shimmer rounded-lg" />
        <div className="h-8 w-48 shimmer rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-1">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="h-24 w-24 shimmer rounded-full" />
              <div className="h-6 w-32 shimmer rounded" />
              <div className="h-4 w-48 shimmer rounded" />
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="glass-card">
              <CardContent className="p-6">
                <div className="h-12 w-12 shimmer rounded-xl mb-4" />
                <div className="h-8 w-24 shimmer rounded mb-2" />
                <div className="h-4 w-32 shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useAdminUserDetail(id);
  const { mutate: performAction, isPending: isActionPending } = useAdminUserActions();
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: UserAction | null;
    title: string;
    description: string;
  }>({ open: false, action: null, title: "", description: "" });

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[400px]">
        <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <UserIcon className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-destructive font-semibold text-lg">Failed to load user</p>
        <p className="text-sm text-muted-foreground">{error?.message || "User not found"}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
          </Button>
        </div>
      </div>
    );
  }

  const { user, financialSummary, accounts, debts, savingsGoals, recentTransactions, bills, budgets, recurringTransactions, subscription, networthSnapshots } = data;
  const isSuspended = user.banned_until && new Date(user.banned_until) > new Date();

  const handleAction = (action: UserAction) => {
    const configs: Record<UserAction, { title: string; description: string }> = {
      suspend: { title: "Suspend User", description: `Suspend ${user.email} for 30 days.` },
      unsuspend: { title: "Lift Suspension", description: `Restore ${user.email}'s access.` },
      delete: { title: "Delete User", description: `Permanently delete ${user.email} and all data. Cannot be undone.` },
      promote: { title: "Promote to Admin", description: `Give ${user.email} admin privileges.` },
      demote: { title: "Remove Admin", description: `Remove admin privileges from ${user.email}.` },
      resend_confirmation: { title: "Resend Confirmation", description: `Send new confirmation email to ${user.email}.` },
    };
    setConfirmDialog({ open: true, action, ...configs[action] });
  };

  const executeAction = () => {
    if (confirmDialog.action && id) {
      performAction(
        { userId: id, action: confirmDialog.action },
        {
          onSuccess: () => {
            setConfirmDialog({ open: false, action: null, title: "", description: "" });
            if (confirmDialog.action === "delete") navigate("/admin/users");
            else refetch();
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">User Details</h1>
            <p className="text-muted-foreground">View and manage user account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="mr-2 h-4 w-4" /> Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>User Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!user.email_confirmed_at && (
                <DropdownMenuItem onClick={() => handleAction("resend_confirmation")}>
                  <Mail className="mr-2 h-4 w-4" /> Resend Confirmation
                </DropdownMenuItem>
              )}
              {user.is_admin ? (
                <DropdownMenuItem onClick={() => handleAction("demote")}>
                  <UserX className="mr-2 h-4 w-4" /> Remove Admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleAction("promote")}>
                  <Crown className="mr-2 h-4 w-4" /> Make Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isSuspended ? (
                <DropdownMenuItem onClick={() => handleAction("unsuspend")}>
                  <UserCheck className="mr-2 h-4 w-4" /> Lift Suspension
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleAction("suspend")} className="text-warning">
                  <Ban className="mr-2 h-4 w-4" /> Suspend User
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* User Profile & Financial Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="glass-card lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-border/50 shadow-lg">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-2xl font-bold">
                  {user.display_name?.charAt(0) || user.email?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-xl font-bold text-foreground">{user.display_name || "No name"}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {user.is_admin && (
                  <Badge className="bg-purple/10 text-purple border border-purple/20">
                    <Crown className="mr-1 h-3 w-3" /> Admin
                  </Badge>
                )}
                {user.email_confirmed_at ? (
                  <Badge className="bg-primary/10 text-primary border border-primary/20">
                    <UserCheck className="mr-1 h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge className="bg-warning/10 text-warning border border-warning/20">Unverified</Badge>
                )}
                {isSuspended && <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" /> Suspended</Badge>}
              </div>
              <Separator className="my-6" />
              <div className="w-full space-y-4 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="font-medium">{format(new Date(user.created_at), "MMMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Last Active</p>
                    <p className="font-medium">{user.last_sign_in_at ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true }) : "Never"}</p>
                  </div>
                </div>
                {subscription && (
                  <div className="flex items-center gap-3 text-sm">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Subscription</p>
                      <p className="font-medium capitalize">{subscription.status} {subscription.plan_type ? `(${subscription.plan_type})` : ''}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Stats */}
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          <Card className="glass-card border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary mb-3">
                <Wallet className="h-6 w-6 text-primary-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(financialSummary.totalBalance, user.currency)}</p>
              <p className="text-sm text-muted-foreground">{financialSummary.accountCount} accounts</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info mb-3">
                <TrendingUp className="h-6 w-6 text-info-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(financialSummary.totalIncome, user.currency)}</p>
              <p className="text-sm text-muted-foreground">Total Income</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-pink">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-pink mb-3">
                <TrendingDown className="h-6 w-6 text-pink-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(financialSummary.totalExpenses, user.currency)}</p>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-purple">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple mb-3">
                <CreditCard className="h-6 w-6 text-purple-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(financialSummary.totalDebt, user.currency)}</p>
              <p className="text-sm text-muted-foreground">{financialSummary.debtCount} active debts</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Data Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-background">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-background">
            Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-background">
            Goals ({savingsGoals.length})
          </TabsTrigger>
          <TabsTrigger value="debts" className="data-[state=active]:bg-background">
            Debts ({debts.length})
          </TabsTrigger>
          <TabsTrigger value="bills" className="data-[state=active]:bg-background">
            Bills ({bills?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="budgets" className="data-[state=active]:bg-background">
            Budgets ({budgets?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="recurring" className="data-[state=active]:bg-background">
            Recurring ({recurringTransactions?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 15 transactions across all types</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <EmptyState icon={Wallet} text="No transactions yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((tx) => (
                      <TableRow key={`${tx.type}-${tx.id}`} className="border-border/30">
                        <TableCell className="text-muted-foreground">{format(new Date(tx.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "capitalize",
                            tx.type === "income" && "bg-primary/10 text-primary border-primary/20",
                            tx.type === "expense" && "bg-pink/10 text-pink border-pink/20",
                            tx.type === "transfer" && "bg-info/10 text-info border-info/20"
                          )}>{tx.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tx.category || tx.source || "—"}</TableCell>
                        <TableCell className={cn("text-right font-medium", tx.type === "income" && "text-primary", tx.type === "expense" && "text-pink")}>
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{formatCurrency(tx.amount, user.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <EmptyState icon={Wallet} text="No accounts" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {accounts.map((account) => (
                    <Card key={account.id} className="bg-card/50 border-border/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${account.color}20` }}>
                            <Wallet className="h-5 w-5" style={{ color: account.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{account.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-lg font-bold">{formatCurrency(account.initial_balance, user.currency)}</p>
                          <Badge variant={account.is_active ? "default" : "secondary"} className="text-xs">{account.is_active ? "Active" : "Inactive"}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals">
          <Card className="glass-card">
            <CardHeader><CardTitle>Savings Goals</CardTitle></CardHeader>
            <CardContent>
              {savingsGoals.length === 0 ? (
                <EmptyState icon={Target} text="No savings goals" />
              ) : (
                <div className="space-y-4">
                  {savingsGoals.map((goal) => {
                    const progress = (goal.current_amount / goal.target_amount) * 100;
                    return (
                      <div key={goal.id} className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${goal.color}20` }}>
                              <PiggyBank className="h-5 w-5" style={{ color: goal.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{goal.name}</p>
                              {goal.deadline && <p className="text-xs text-muted-foreground">Due: {format(new Date(goal.deadline), "MMM d, yyyy")}</p>}
                            </div>
                          </div>
                          <Badge variant={goal.is_completed ? "default" : "secondary"}>{goal.is_completed ? "Done" : `${progress.toFixed(0)}%`}</Badge>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">{formatCurrency(goal.current_amount, user.currency)}</span>
                          <span className="font-medium">{formatCurrency(goal.target_amount, user.currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debts Tab */}
        <TabsContent value="debts">
          <Card className="glass-card">
            <CardHeader><CardTitle>Debts</CardTitle></CardHeader>
            <CardContent>
              {debts.length === 0 ? (
                <EmptyState icon={CreditCard} text="No debts" />
              ) : (
                <div className="space-y-4">
                  {debts.map((debt) => {
                    const paidOff = debt.starting_balance - debt.current_balance;
                    const progress = (paidOff / debt.starting_balance) * 100;
                    return (
                      <div key={debt.id} className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${debt.color}20` }}>
                              <CreditCard className="h-5 w-5" style={{ color: debt.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{debt.name}</p>
                              <p className="text-xs text-muted-foreground">{debt.interest_rate}% APR • Min: {formatCurrency(debt.minimum_payment, user.currency)}</p>
                            </div>
                          </div>
                          <Badge variant={debt.is_active ? "destructive" : "secondary"}>{debt.is_active ? "Active" : "Paid Off"}</Badge>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">Remaining: {formatCurrency(debt.current_balance, user.currency)}</span>
                          <span className="font-medium text-primary">{progress.toFixed(0)}% paid</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Bills</CardTitle>
              <CardDescription>{financialSummary.activeBillCount} active of {financialSummary.billCount} total</CardDescription>
            </CardHeader>
            <CardContent>
              {!bills || bills.length === 0 ? (
                <EmptyState icon={FileText} text="No bills" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Day</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id} className="border-border/30">
                        <TableCell className="font-medium">{bill.name}</TableCell>
                        <TableCell>{formatCurrency(bill.amount, user.currency)}</TableCell>
                        <TableCell>{bill.due_day}</TableCell>
                        <TableCell className="capitalize">{bill.frequency}</TableCell>
                        <TableCell>
                          <Badge variant={bill.is_active ? "default" : "secondary"}>{bill.is_active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budgets Tab */}
        <TabsContent value="budgets">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Budgets</CardTitle>
              <CardDescription>{budgets?.length || 0} category budgets</CardDescription>
            </CardHeader>
            <CardContent>
              {!budgets || budgets.length === 0 ? (
                <EmptyState icon={BarChart3} text="No budgets" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {budgets.map((budget) => (
                    <Card key={budget.id} className="bg-card/50 border-border/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${budget.categories?.color || '#6B7280'}20` }}>
                            <BarChart3 className="h-4 w-4" style={{ color: budget.categories?.color || '#6B7280' }} />
                          </div>
                          <p className="font-medium">{budget.categories?.name || 'Unknown'}</p>
                        </div>
                        <p className="text-lg font-bold">{formatCurrency(budget.monthly_limit, user.currency)}</p>
                        <p className="text-xs text-muted-foreground">Monthly limit</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recurring Transactions Tab */}
        <TabsContent value="recurring">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recurring Transactions</CardTitle>
              <CardDescription>{financialSummary.activeRecurringCount} active of {financialSummary.recurringCount} total</CardDescription>
            </CardHeader>
            <CardContent>
              {!recurringTransactions || recurringTransactions.length === 0 ? (
                <EmptyState icon={Repeat} text="No recurring transactions" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringTransactions.map((rt) => (
                      <TableRow key={rt.id} className="border-border/30">
                        <TableCell className="font-medium">{rt.description}</TableCell>
                        <TableCell className={cn(rt.type === "income" ? "text-primary" : "text-pink")}>
                          {formatCurrency(rt.amount, user.currency)}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{rt.type}</Badge></TableCell>
                        <TableCell className="capitalize">{rt.frequency}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(rt.next_due), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={rt.is_active ? "default" : "secondary"}>{rt.is_active ? "Active" : "Paused"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Net Worth Section */}
      {networthSnapshots && networthSnapshots.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <CardTitle>Net Worth History</CardTitle>
            </div>
            <CardDescription>Last {networthSnapshots.length} snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Liabilities</TableHead>
                  <TableHead className="text-right">Net Worth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networthSnapshots.map((snap) => (
                  <TableRow key={snap.id} className="border-border/30">
                    <TableCell>{format(new Date(snap.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-primary">{formatCurrency(snap.total_assets, user.currency)}</TableCell>
                    <TableCell className="text-pink">{formatCurrency(snap.total_liabilities, user.currency)}</TableCell>
                    <TableCell className={cn("text-right font-bold", snap.net_worth >= 0 ? "text-primary" : "text-pink")}>
                      {formatCurrency(snap.net_worth, user.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              disabled={isActionPending}
              className={cn(confirmDialog.action === "delete" && "bg-destructive text-destructive-foreground")}
            >
              {isActionPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
