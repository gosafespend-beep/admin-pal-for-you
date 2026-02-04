import { useState } from "react";
import { 
  ClipboardList, 
  Mail, 
  Calendar,
  CheckCircle,
  Clock,
  Search,
  MoreHorizontal,
  Send,
  Trash2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function WaitlistRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

export default function Waitlist() {
  const [searchQuery, setSearchQuery] = useState("");

  // Note: We can only get the count, not the actual entries due to RLS
  const { data: waitlistCount, isLoading: loadingCount } = useQuery({
    queryKey: ["admin", "waitlist-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_count");
      if (error) throw error;
      return data as number;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Waitlist</h1>
        <p className="text-muted-foreground">
          Manage waitlist entries and send invitations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingCount ? <Skeleton className="h-8 w-8" /> : waitlistCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loadingCount ? <Skeleton className="h-8 w-8" /> : waitlistCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Waitlist Management
          </CardTitle>
          <CardDescription>
            Due to security policies, waitlist entries are protected. To view and manage entries:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="mb-2 font-medium text-foreground">To access waitlist data:</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Go to your Supabase Dashboard</li>
              <li>Navigate to Table Editor → waitlist</li>
              <li>View and manage entries directly</li>
            </ol>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor/29541" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ClipboardList className="h-4 w-4" />
                Open in Supabase
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
          <CardDescription>
            {waitlistCount || 0} total entries in waitlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
                disabled
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      Access waitlist entries via Supabase Dashboard
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
