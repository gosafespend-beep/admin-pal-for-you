import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  ExternalLink,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
        <Button variant="outline" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>
    );
  }

  const { user, financialSummary, accounts, debts, savingsGoals, recentTransactions } = data;
  const isSuspended = user.banned_until && new Date(user.banned_until) > new Date();

  const handleAction = (action: UserAction) => {
    const configs: Record<UserAction, { title: string; description: string }> = {
      suspend: {
        title: "Suspend User",
        description: `This will suspend ${user.email} for 30 days. They won't be able to access their account.`,
      },
      unsuspend: {
        title: "Lift Suspension",
        description: `This will restore ${user.email}'s access to their account immediately.`,
      },
      delete: {
        title: "Delete User Permanently",
        description: `This will permanently delete ${user.email} and all their data. This action cannot be undone.`,
      },
      promote: {
        title: "Promote to Admin",
        description: `This will give ${user.email} full admin privileges to manage the platform.`,
      },
      demote: {
        title: "Remove Admin Privileges",
        description: `This will remove admin privileges from ${user.email}. They will become a regular user.`,
      },
      resend_confirmation: {
        title: "Resend Confirmation Email",
        description: `This will send a new confirmation email to ${user.email}.`,
      },
    };

    setConfirmDialog({
      open: true,
      action,
      ...configs[action],
    });
  };

  const executeAction = () => {
    if (confirmDialog.action && id) {
      performAction(
        { userId: id, action: confirmDialog.action },
        {
          onSuccess: () => {
            setConfirmDialog({ open: false, action: null, title: "", description: "" });
            if (confirmDialog.action === "delete") {
              navigate("/admin/users");
            } else {
              refetch();
            }
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
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="mr-2 h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>User Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!user.email_confirmed_at && (
                <DropdownMenuItem onClick={() => handleAction("resend_confirmation")}>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Confirmation
                </DropdownMenuItem>
              )}
              {user.is_admin ? (
                <DropdownMenuItem onClick={() => handleAction("demote")}>
                  <UserX className="mr-2 h-4 w-4" />
                  Remove Admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleAction("promote")}>
                  <Crown className="mr-2 h-4 w-4" />
                  Make Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isSuspended ? (
                <DropdownMenuItem onClick={() => handleAction("unsuspend")}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Lift Suspension
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleAction("suspend")} className="text-warning">
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend User
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleAction("delete")} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
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
                <AvatarImage src={user.avatar_url || undefined} alt={user.display_name || user.email} />
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-2xl font-bold">
                  {user.display_name?.charAt(0) || user.email?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              
              <h2 className="mt-4 text-xl font-bold text-foreground">
                {user.display_name || "No display name"}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {user.is_admin && (
                  <Badge className="bg-purple/10 text-purple border border-purple/20">
                    <Crown className="mr-1 h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {user.email_confirmed_at ? (
                  <Badge className="bg-primary/10 text-primary border border-primary/20">
                    <UserCheck className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-warning/10 text-warning border border-warning/20">
                    <Mail className="mr-1 h-3 w-3" />
                    Unverified
                  </Badge>
                )}
                {isSuspended && (
                  <Badge variant="destructive">
                    <Ban className="mr-1 h-3 w-3" />
                    Suspended
                  </Badge>
                )}
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
                    <p className="font-medium">
                      {user.last_sign_in_at
                        ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                        : "Never"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Roles</p>
                    <p className="font-medium capitalize">{user.roles.join(", ") || "User"}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Stats */}
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                  <Wallet className="h-6 w-6 text-primary-foreground" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {financialSummary.accountCount} accounts
                </Badge>
              </div>
              <p className="mt-4 text-3xl font-bold text-foreground">
                {formatCurrency(financialSummary.totalBalance, user.currency)}
              </p>
              <p className="text-sm text-muted-foreground">Total Balance</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-l-4 border-l-info hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info">
                  <TrendingUp className="h-6 w-6 text-info-foreground" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-foreground">
                {formatCurrency(financialSummary.totalIncome, user.currency)}
              </p>
              <p className="text-sm text-muted-foreground">Total Income</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-l-4 border-l-pink hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-pink">
                  <TrendingDown className="h-6 w-6 text-pink-foreground" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-foreground">
                {formatCurrency(financialSummary.totalExpenses, user.currency)}
              </p>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-l-4 border-l-purple hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple">
                  <CreditCard className="h-6 w-6 text-purple-foreground" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {financialSummary.debtCount} active
                </Badge>
              </div>
              <p className="mt-4 text-3xl font-bold text-foreground">
                {formatCurrency(financialSummary.totalDebt, user.currency)}
              </p>
              <p className="text-sm text-muted-foreground">Total Debt</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Data Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-background">
            Recent Transactions
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-background">
            Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-background">
            Savings Goals ({savingsGoals.length})
          </TabsTrigger>
          <TabsTrigger value="debts" className="data-[state=active]:bg-background">
            Debts ({debts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 15 transactions across all types</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No transactions yet</p>
                </div>
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
                        <TableCell className="text-muted-foreground">
                          {format(new Date(tx.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "capitalize",
                              tx.type === "income" && "bg-primary/10 text-primary border-primary/20",
                              tx.type === "expense" && "bg-pink/10 text-pink border-pink/20",
                              tx.type === "transfer" && "bg-info/10 text-info border-info/20"
                            )}
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.category || tx.source || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            tx.type === "income" && "text-primary",
                            tx.type === "expense" && "text-pink"
                          )}
                        >
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                          {formatCurrency(tx.amount, user.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>All linked financial accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No accounts created</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {accounts.map((account) => (
                    <Card key={account.id} className="bg-card/50 border-border/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${account.color}20` }}
                          >
                            <Wallet className="h-5 w-5" style={{ color: account.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{account.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{account.type}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-lg font-bold">
                            {formatCurrency(account.initial_balance, user.currency)}
                          </p>
                          <Badge variant={account.is_active ? "default" : "secondary"} className="text-xs">
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Savings Goals</CardTitle>
              <CardDescription>User's financial targets</CardDescription>
            </CardHeader>
            <CardContent>
              {savingsGoals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No savings goals set</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savingsGoals.map((goal) => {
                    const progress = (goal.current_amount / goal.target_amount) * 100;
                    return (
                      <div key={goal.id} className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${goal.color}20` }}
                            >
                              <PiggyBank className="h-5 w-5" style={{ color: goal.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{goal.name}</p>
                              {goal.deadline && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(new Date(goal.deadline), "MMM d, yyyy")}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={goal.is_completed ? "default" : "secondary"}>
                            {goal.is_completed ? "Completed" : `${progress.toFixed(0)}%`}
                          </Badge>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatCurrency(goal.current_amount, user.currency)}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(goal.target_amount, user.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debts">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Debts</CardTitle>
              <CardDescription>User's outstanding liabilities</CardDescription>
            </CardHeader>
            <CardContent>
              {debts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No debts recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {debts.map((debt) => {
                    const paidOff = debt.starting_balance - debt.current_balance;
                    const progress = (paidOff / debt.starting_balance) * 100;
                    return (
                      <div key={debt.id} className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-10 w-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${debt.color}20` }}
                            >
                              <CreditCard className="h-5 w-5" style={{ color: debt.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{debt.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {debt.interest_rate}% APR • Min: {formatCurrency(debt.minimum_payment, user.currency)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={debt.is_active ? "destructive" : "secondary"}>
                            {debt.is_active ? "Active" : "Paid Off"}
                          </Badge>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Remaining: {formatCurrency(debt.current_balance, user.currency)}
                          </span>
                          <span className="font-medium text-primary">
                            {progress.toFixed(0)}% paid
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              className={cn(
                confirmDialog.action === "delete" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isActionPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
