import { useState } from "react";
import { 
  ClipboardList, 
  Mail, 
  Clock,
  CheckCircle,
  Search,
  Send,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useAdminWaitlist, useWaitlistActions, WaitlistFilters } from "@/hooks/admin/useAdminWaitlist";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { MobileCardList } from "@/components/admin/MobileCardList";

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle },
  rejected: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

export default function Waitlist() {
  const [filters, setFilters] = useState<WaitlistFilters>({
    search: "",
    status: "",
    page: 1,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, error, refetch } = useAdminWaitlist(filters);
  const { updateStatus, deleteEntry } = useWaitlistActions();

  const entries = data?.data || [];
  const counts = data?.statusCounts || { total: 0, pending: 0, approved: 0, rejected: 0 };
  const totalPages = Math.ceil((data?.total || 0) / filters.pageSize);

  const handleSearch = () => setFilters(f => ({ ...f, search: searchInput, page: 1 }));

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState
          icon={ClipboardList}
          title="Failed to load waitlist"
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Waitlist</h1>
          <p className="text-muted-foreground">
            Manage waitlist entries and send invitations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(entries as unknown as Record<string, unknown>[], "waitlist-export")} disabled={!entries.length}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, status: "", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <ClipboardList className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-warning hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, status: "pending", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-warning">
                <Clock className="h-6 w-6 text-warning-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{counts.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, status: "approved", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info">
                <CheckCircle className="h-6 w-6 text-info-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{counts.approved}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Entries</CardTitle>
              <CardDescription>{data?.total || 0} total entries</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-background/50 border-border/50"
                />
              </div>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters(f => ({ ...f, status: v === "all" ? "" : v, page: 1 }))}>
                <SelectTrigger className="w-[130px] bg-background/50 border-border/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSearch}>Search</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    <TableCell><div className="h-4 w-48 shimmer rounded" /></TableCell>
                    <TableCell><div className="h-5 w-20 shimmer rounded-full" /></TableCell>
                    <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
                    <TableCell><div className="h-4 w-8 shimmer rounded" /></TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No entries found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const sc = statusConfig[entry.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  return (
                    <TableRow key={entry.id} className="border-border/30 hover:bg-card/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{entry.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${sc.color} gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {entry.status !== "approved" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: entry.id, status: "approved" })}
                                className="gap-2"
                              >
                                <CheckCircle className="h-4 w-4 text-primary" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {entry.status !== "rejected" && (
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: entry.id, status: "rejected" })}
                                className="gap-2"
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                                Reject
                              </DropdownMenuItem>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove {entry.email} from the waitlist.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteEntry.mutate(entry.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
              <p className="text-sm text-muted-foreground">
                Page {filters.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
