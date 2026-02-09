import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Eye,
  UserCheck,
  UserX,
  Crown,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Ban
} from "lucide-react";
import { useAdminUsers, AdminUser, AdminUsersFilters } from "@/hooks/admin/useAdminUsers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminErrorState } from "@/components/admin/AdminErrorState";
import { MobileCardList } from "@/components/admin/MobileCardList";

function UserRowSkeleton() {
  return (
    <TableRow className="border-border/30">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full shimmer" />
          <div className="space-y-1">
            <div className="h-4 w-24 shimmer rounded" />
            <div className="h-3 w-32 shimmer rounded" />
          </div>
        </div>
      </TableCell>
      <TableCell><div className="h-5 w-16 shimmer rounded-full" /></TableCell>
      <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
      <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
      <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
      <TableCell><div className="h-8 w-8 shimmer rounded" /></TableCell>
    </TableRow>
  );
}

function exportToCSV(data: AdminUser[], filename: string) {
  if (!data.length) return;
  const headers = ['email', 'display_name', 'is_admin', 'email_confirmed_at', 'created_at', 'last_sign_in_at'];
  const csvContent = [
    headers.join(','),
    ...data.map(u => headers.map(h => `"${String(h in u ? (u as unknown as Record<string, unknown>)[h] : '')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Users() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AdminUsersFilters>({
    search: "",
    role: "",
    verified: "",
    page: 1,
    pageSize: 20,
    sortBy: "created_at",
    sortOrder: "desc",
  });
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, error, refetch } = useAdminUsers(filters);

  const users = data?.users || [];
  const total = data?.total || 0;
  const stats = data?.stats || { totalAdmins: 0, totalVerified: 0, totalSuspended: 0 };
  const totalPages = Math.ceil(total / filters.pageSize);

  const handleSearch = useCallback(() => {
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  }, [searchInput]);

  if (error) {
    return (
      <div className="animate-fade-in">
        <AdminErrorState
          icon={UserIcon}
          title="Failed to load users"
          description="Please check your connection and try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
          <p className="text-muted-foreground">
            Manage all platform users • {total} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(users, "users-export")}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, role: "", verified: "", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <UserIcon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-purple hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, role: "admin", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple">
                <Crown className="h-6 w-6 text-purple-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.totalAdmins}</p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-info hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, verified: "verified", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info">
                <UserCheck className="h-6 w-6 text-info-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.totalVerified}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-destructive hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setFilters(f => ({ ...f, role: "", verified: "", page: 1 }))}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <Ban className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{stats.totalSuspended}</p>
                <p className="text-sm text-muted-foreground">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <Select value={filters.role || "all"} onValueChange={(v) => setFilters(f => ({ ...f, role: v === "all" ? "" : v, page: 1 }))}>
              <SelectTrigger className="w-full md:w-[150px] bg-background/50 border-border/50">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.verified || "all"} onValueChange={(v) => setFilters(f => ({ ...f, verified: v === "all" ? "" : v, page: 1 }))}>
              <SelectTrigger className="w-full md:w-[150px] bg-background/50 border-border/50">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(filters.pageSize)} onValueChange={(v) => setFilters(f => ({ ...f, pageSize: parseInt(v), page: 1 }))}>
              <SelectTrigger className="w-full md:w-[100px] bg-background/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10/page</SelectItem>
                <SelectItem value="20">20/page</SelectItem>
                <SelectItem value="50">50/page</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Page {filters.page} of {totalPages || 1} ({total} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile card view */}
          {!isLoading && (
            <MobileCardList
              items={users}
              renderCard={(user) => (
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/admin/users/${user.id}`)}
                >
                  <Avatar className="h-10 w-10 border-2 border-border/50">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {user.display_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{user.display_name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {user.is_admin && <Badge className="bg-purple/10 text-purple border-purple/20 text-xs"><Crown className="mr-1 h-3 w-3" />Admin</Badge>}
                      {user.email_confirmed_at
                        ? <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Verified</Badge>
                        : <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">Unverified</Badge>
                      }
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d') : ''}
                  </span>
                </div>
              )}
            />
          )}
          {/* Desktop table */}
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Role</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="text-muted-foreground">Last Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserX className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))
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

function UserRow({ user }: { user: AdminUser }) {
  const navigate = useNavigate();
  const isSuspended = user.banned_until && new Date(user.banned_until) > new Date();

  return (
    <TableRow 
      className="border-border/30 hover:bg-card/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/admin/users/${user.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-border/50">
            <AvatarImage src={user.avatar_url || undefined} alt={user.display_name || user.email} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
              {user.display_name?.charAt(0) || user.email?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{user.display_name || 'No name'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {user.is_admin ? (
          <Badge className="bg-purple/10 text-purple border border-purple/20">
            <Crown className="mr-1 h-3 w-3" /> Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border border-border/50">User</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {user.email_confirmed_at ? (
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">
              <UserCheck className="mr-1 h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge className="bg-warning/10 text-warning border border-warning/20 text-xs">Unverified</Badge>
          )}
          {isSuspended && (
            <Badge variant="destructive" className="text-xs">
              <Ban className="mr-1 h-3 w-3" /> Suspended
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'Unknown'}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {user.last_sign_in_at 
            ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
            : 'Never'}
        </span>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={() => navigate(`/admin/users/${user.id}`)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Mail className="h-4 w-4" /> Send Email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
