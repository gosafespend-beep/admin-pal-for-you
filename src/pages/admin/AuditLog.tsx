import { useState } from "react";
import { format } from "date-fns";
import {
  Shield, ChevronLeft, ChevronRight, FileText,
} from "lucide-react";
import { useAdminAuditLog, type AuditLogFilters } from "@/hooks/admin/useAdminAuditLog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  suspend: "bg-warning/10 text-warning border-warning/20",
  unsuspend: "bg-primary/10 text-primary border-primary/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  promote: "bg-purple/10 text-purple border-purple/20",
  demote: "bg-muted text-muted-foreground border-border",
  extend_trial: "bg-info/10 text-info border-info/20",
  cancel: "bg-destructive/10 text-destructive border-destructive/20",
  reactivate: "bg-primary/10 text-primary border-primary/20",
  add_note: "bg-info/10 text-info border-info/20",
};

export default function AuditLog() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 30,
    action: "",
    targetType: "",
  });

  const { data, isLoading, error, refetch } = useAdminAuditLog(filters);
  const entries = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / filters.pageSize);

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState icon={Shield} title="Failed to load audit log" description="Please try again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
        <p className="text-muted-foreground">Track all admin actions for accountability</p>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <Select value={filters.action || "all"} onValueChange={(v) => setFilters(f => ({ ...f, action: v === "all" ? "" : v, page: 1 }))}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/50">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="suspend">Suspend</SelectItem>
                <SelectItem value="unsuspend">Unsuspend</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="promote">Promote</SelectItem>
                <SelectItem value="demote">Demote</SelectItem>
                <SelectItem value="extend_trial">Extend Trial</SelectItem>
                <SelectItem value="cancel">Cancel</SelectItem>
                <SelectItem value="reactivate">Reactivate</SelectItem>
                <SelectItem value="add_note">Add Note</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.targetType || "all"} onValueChange={(v) => setFilters(f => ({ ...f, targetType: v === "all" ? "" : v, page: 1 }))}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/50">
                <SelectValue placeholder="Target Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Targets</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="waitlist">Waitlist</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>{total} entries</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 shimmer rounded" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No audit log entries yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Time</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="border-border/30">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{entry.adminEmail}</TableCell>
                    <TableCell>
                      <Badge className={cn("capitalize", ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground border-border")}>
                        {entry.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">{entry.target_type}</span>
                      <span className="text-xs text-muted-foreground/50 ml-1 truncate max-w-[100px] inline-block align-bottom">
                        {entry.target_id.slice(0, 8)}…
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {entry.details ? JSON.stringify(entry.details).slice(0, 60) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
              <p className="text-sm text-muted-foreground">Page {filters.page} of {totalPages}</p>
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
