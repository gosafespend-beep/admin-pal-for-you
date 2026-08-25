import { useState } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Clock,
  XCircle,
  CreditCard,
  MoreHorizontal,
  CalendarPlus,
  Power,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminSubscriptions, useSubscriptionAction } from "@/hooks/admin/useAdminSubscriptions";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  trialing: "bg-info/10 text-info border-info/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<string, typeof Zap> = {
  active: Zap,
  trialing: Clock,
  cancelled: XCircle,
  expired: XCircle,
};

export default function Subscriptions() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    subscriptionId: string;
    action: string;
    title: string;
    description: string;
  }>({ open: false, subscriptionId: "", action: "", title: "", description: "" });

  const { data, isLoading, error, refetch } = useAdminSubscriptions({ page, pageSize, status, search });
  const { mutate: performAction, isPending: isActioning } = useSubscriptionAction();

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSubscriptionAction = (subId: string, action: string, email: string) => {
    const configs: Record<string, { title: string; description: string }> = {
      extend_trial: { title: "Extend Trial", description: `Extend trial by 7 days for ${email}.` },
      cancel: { title: "Cancel Subscription", description: `Cancel subscription for ${email}.` },
      reactivate: { title: "Reactivate Subscription", description: `Reactivate subscription for ${email} with a 30-day period.` },
    };
    setConfirmAction({ open: true, subscriptionId: subId, action, ...configs[action] });
  };

  const executeAction = () => {
    performAction(
      { subscriptionId: confirmAction.subscriptionId, action: confirmAction.action as 'extend_trial' | 'cancel' | 'reactivate' },
      { onSuccess: () => setConfirmAction({ open: false, subscriptionId: "", action: "", title: "", description: "" }) }
    );
  };

  const exportCSV = () => {
    if (!data?.subscriptions?.length) return;
    const headers = ["Email", "Status", "Plan", "Trial Start", "Trial End", "Created"];
    const rows = data.subscriptions.map((s) => [
      s.userEmail, s.status, s.plan_type || "free", s.trial_start, s.trial_end, s.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState
          icon={CreditCard}
          title="Failed to load subscriptions"
          description="Please check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground">Manage platform subscriptions and revenue</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.subscriptions?.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Total", value: data.stats.total, icon: Users, color: "primary" },
            { label: "Active", value: data.stats.active, icon: Zap, color: "primary" },
            { label: "Trialing", value: data.stats.trialing, icon: Clock, color: "info" },
            { label: "Cancelled", value: data.stats.cancelled, icon: XCircle, color: "destructive" },
            { label: "Expired", value: data.stats.expired, icon: XCircle, color: "warning" },
          ].map((stat) => (
            <Card key={stat.label} className="glass-card border-l-4" style={{ borderLeftColor: `hsl(var(--${stat.color}))` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${stat.color}/10`}>
                    <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Entitlement health */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Entitlement Health</h2>
            </div>
            {!data?.entitlementHealth?.length ? (
              <p className="text-sm text-muted-foreground">No entitlement issues detected.</p>
            ) : (
              <div className="space-y-2">
                {data.entitlementHealth.map((c) => (
                  <div key={c.check_name} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-card/50 border border-border/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.check_name}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    <Badge className={
                      c.severity === "error" ? "bg-destructive/10 text-destructive border-destructive/20"
                        : c.severity === "warn" ? "bg-warning/10 text-warning border-warning/20"
                          : "bg-primary/10 text-primary border-primary/20"
                    }>{c.affected}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple" />
              <h2 className="font-semibold text-foreground">RevenueCat Entitlements</h2>
            </div>
            {!data?.entitlements?.length ? (
              <p className="text-sm text-muted-foreground">No store entitlements recorded yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead>User</TableHead>
                      <TableHead>Entitlement</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entitlements.map((e, i) => (
                      <TableRow key={`${e.user_id}-${e.entitlement}-${i}`} className="border-border/30">
                        <TableCell className="text-xs">{e.userEmail}</TableCell>
                        <TableCell className="text-xs">
                          <Badge className={e.is_active ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                            {e.entitlement}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.store || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.expires_at ? format(new Date(e.expires_at), "MMM d, yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 bg-card/50"
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40 bg-card/50">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {/* Mobile card view */}
          {!isLoading && data?.subscriptions && (
            <div className="md:hidden p-4 space-y-3">
              {data.subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  No subscriptions found
                </div>
              ) : data.subscriptions.map((sub) => {
                const Icon = statusIcons[sub.status] || Zap;
                return (
                  <Card key={sub.id} className="glass-card">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{sub.userEmail}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusColors[sub.status] || statusColors.expired} border text-xs`}>
                            <Icon className="mr-1 h-3 w-3" />{sub.status}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {sub.status === "trialing" && (
                                <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "extend_trial", sub.userEmail)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" /> Extend Trial
                                </DropdownMenuItem>
                              )}
                              {(sub.status === "active" || sub.status === "trialing") && (
                                <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "cancel", sub.userEmail)} className="text-destructive">
                                  <Power className="mr-2 h-4 w-4" /> Cancel
                                </DropdownMenuItem>
                              )}
                              {(sub.status === "cancelled" || sub.status === "expired") && (
                                <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "reactivate", sub.userEmail)}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Plan: {sub.plan_type || "Free"}</span>
                        <span>{format(new Date(sub.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Trial Period</TableHead>
                <TableHead>Current Period</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 shimmer rounded w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.subscriptions?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    No subscriptions found
                  </TableCell>
                </TableRow>
              ) : (
                data.subscriptions.map((sub) => {
                  const Icon = statusIcons[sub.status] || Zap;
                  return (
                    <TableRow key={sub.id} className="border-border/30 hover:bg-card/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {sub.userEmail.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{sub.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[sub.status] || statusColors.expired} border`}>
                          <Icon className="mr-1 h-3 w-3" />
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{sub.plan_type || "Free"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <div>{format(new Date(sub.trial_start), "MMM d, yyyy")}</div>
                          <div className="text-muted-foreground/60">→ {format(new Date(sub.trial_end), "MMM d, yyyy")}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.current_period_start ? (
                          <div className="text-xs text-muted-foreground">
                            <div>{format(new Date(sub.current_period_start), "MMM d, yyyy")}</div>
                            <div className="text-muted-foreground/60">→ {sub.current_period_end ? format(new Date(sub.current_period_end), "MMM d, yyyy") : "—"}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(sub.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Manage</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {sub.status === "trialing" && (
                              <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "extend_trial", sub.userEmail)}>
                                <CalendarPlus className="mr-2 h-4 w-4" /> Extend Trial (+7d)
                              </DropdownMenuItem>
                            )}
                            {(sub.status === "active" || sub.status === "trialing") && (
                              <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "cancel", sub.userEmail)} className="text-destructive">
                                <Power className="mr-2 h-4 w-4" /> Cancel
                              </DropdownMenuItem>
                            )}
                            {(sub.status === "cancelled" || sub.status === "expired") && (
                              <DropdownMenuItem onClick={() => handleSubscriptionAction(sub.id, "reactivate", sub.userEmail)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total || 0} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Action Dialog */}
      <AlertDialog open={confirmAction.open} onOpenChange={(open) => !open && setConfirmAction({ ...confirmAction, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction} disabled={isActioning}>
              {isActioning ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
