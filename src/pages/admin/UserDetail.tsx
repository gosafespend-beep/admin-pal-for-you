import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  Clock,
  Crown,
  Ban,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
  MoreVertical,
  RefreshCw,
  BarChart3,
  Monitor,
  LogOut,
  Receipt,
  Shield,
} from "lucide-react";
import { useAdminUserDetail, useAdminUserActions, useRevokeSession, type UserAction } from "@/hooks/admin/useAdminUserDetail";
import { UserNotes } from "@/components/admin/UserNotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const { mutate: revokeSession, isPending: isRevoking } = useRevokeSession();
  
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
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
          </Button>
        </div>
      </div>
    );
  }

  const { user, activitySummary, recentTransactions, subscription, sessions } = data;
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
            if (confirmDialog.action === "delete") navigate("/users");
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/users")} className="shrink-0">
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

      {/* User Profile & Activity Summary */}
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

        {/* Activity Summary Stats */}
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
          <Card className="glass-card border-l-4 border-l-primary">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary mb-3">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{activitySummary.totalTransactions}</p>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-info">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info mb-3">
                <Wallet className="h-6 w-6 text-info-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{activitySummary.totalExpenses}</p>
              <p className="text-sm text-muted-foreground">Expenses</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-purple">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple mb-3">
                <Shield className="h-6 w-6 text-purple-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{activitySummary.totalIncomes}</p>
              <p className="text-sm text-muted-foreground">Incomes</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-warning">
            <CardContent className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-warning mb-3">
                <Monitor className="h-6 w-6 text-warning-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{sessions.length}</p>
              <p className="text-sm text-muted-foreground">Active Sessions</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs: Transactions, Subscription, Sessions */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-background">
            Transactions ({activitySummary.totalTransactions})
          </TabsTrigger>
          <TabsTrigger value="subscription" className="data-[state=active]:bg-background">
            Subscription
          </TabsTrigger>
          <TabsTrigger value="sessions" className="data-[state=active]:bg-background">
            Sessions ({sessions.length})
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Last 10 transactions</CardDescription>
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
                          )}>{tx.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{tx.category || tx.source || "—"}</TableCell>
                        <TableCell className={cn("text-right font-medium", tx.type === "income" && "text-primary", tx.type === "expense" && "text-pink")}>
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount, user.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!subscription ? (
                <EmptyState icon={BarChart3} text="No subscription found" />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge className={cn(
                        "capitalize",
                        subscription.status === "active" && "bg-primary/10 text-primary border-primary/20",
                        subscription.status === "trialing" && "bg-info/10 text-info border-info/20",
                        subscription.status === "cancelled" && "bg-destructive/10 text-destructive border-destructive/20",
                        subscription.status === "expired" && "bg-muted text-muted-foreground border-border",
                      )}>{subscription.status}</Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Plan</p>
                      <p className="font-medium text-foreground">{subscription.plan_type || "Free"}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Trial Period</p>
                      <p className="text-sm text-foreground">
                        {format(new Date(subscription.trial_start), "MMM d, yyyy")} → {format(new Date(subscription.trial_end), "MMM d, yyyy")}
                      </p>
                    </div>
                    {subscription.current_period_start && (
                      <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">Current Period</p>
                        <p className="text-sm text-foreground">
                          {format(new Date(subscription.current_period_start), "MMM d, yyyy")} → {subscription.current_period_end ? format(new Date(subscription.current_period_end), "MMM d, yyyy") : "—"}
                        </p>
                      </div>
                    )}
                    {subscription.cancelled_at && (
                      <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">Cancelled At</p>
                        <p className="text-sm text-destructive">{format(new Date(subscription.cancelled_at), "MMM d, yyyy HH:mm")}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Current login sessions for this user</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <EmptyState icon={Monitor} text="No active sessions" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>Device</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.session_id} className="border-border/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground truncate max-w-[200px]">{session.user_agent || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{String(session.ip) || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(session.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={isRevoking}
                            onClick={() => id && revokeSession({ userId: id, sessionId: session.session_id })}
                          >
                            <LogOut className="h-4 w-4 mr-1" /> Revoke
                          </Button>
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

      {/* User Notes */}
      {id && <UserNotes userId={id} />}

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
