import { useState } from "react";
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
  Crown
} from "lucide-react";
import { useAdminUsers, AdminUser } from "@/hooks/admin/useAdminUsers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
      <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
      <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
      <TableCell><div className="h-8 w-8 shimmer rounded" /></TableCell>
    </TableRow>
  );
}

export default function Users() {
  const { data: users, isLoading, error } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Filter users
  const filteredUsers = users?.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || 
      (roleFilter === "admin" && user.is_admin) ||
      (roleFilter === "user" && !user.is_admin);

    return matchesSearch && matchesRole;
  }) || [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[400px]">
        <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <UserIcon className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-destructive font-semibold text-lg">Failed to load users</p>
        <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
        <p className="text-muted-foreground">
          Manage and view all platform users
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <UserIcon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{users?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-purple hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple">
                <Crown className="h-6 w-6 text-purple-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{users?.filter(u => u.is_admin).length || 0}</p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-info hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info">
                <UserCheck className="h-6 w-6 text-info-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{users?.filter(u => u.email_confirmed_at).length || 0}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
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
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/50">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="user">Users Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Role</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="text-muted-foreground">Last Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  <UserRowSkeleton />
                  <UserRowSkeleton />
                  <UserRowSkeleton />
                  <UserRowSkeleton />
                </>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UserX className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const navigate = useNavigate();
  
  const handleViewDetails = () => {
    navigate(`/admin/users/${user.id}`);
  };
  
  return (
    <TableRow 
      className="border-border/30 hover:bg-card/50 transition-colors cursor-pointer"
      onClick={handleViewDetails}
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
            <p className="font-medium text-foreground">
              {user.display_name || 'No name'}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {user.is_admin ? (
          <Badge className="bg-purple/10 text-purple border border-purple/20 hover:bg-purple/20">
            <Crown className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border border-border/50">
            User
          </Badge>
        )}
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
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={handleViewDetails}>
              <Eye className="h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Mail className="h-4 w-4" />
              Send Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive gap-2">
              <UserX className="h-4 w-4" />
              Suspend User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}