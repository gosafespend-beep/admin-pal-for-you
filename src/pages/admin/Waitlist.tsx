import { useState } from "react";
import { 
  ClipboardList, 
  Mail, 
  Clock,
  CheckCircle,
  Search,
  ExternalLink,
  Send,
  Users,
  TrendingUp
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Waitlist() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: waitlistCount, isLoading: loadingCount } = useQuery({
    queryKey: ["admin", "waitlist-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_count");
      if (error) throw error;
      return data as number;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Waitlist</h1>
        <p className="text-muted-foreground">
          Manage waitlist entries and send invitations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <ClipboardList className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {loadingCount ? (
                    <span className="inline-block h-8 w-8 shimmer rounded" />
                  ) : (
                    waitlistCount || 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-warning hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-warning">
                <Clock className="h-6 w-6 text-warning-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {loadingCount ? (
                    <span className="inline-block h-8 w-8 shimmer rounded" />
                  ) : (
                    waitlistCount || 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-info hover:scale-[1.02] transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-info">
                <CheckCircle className="h-6 w-6 text-info-foreground" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="glass-card overflow-hidden">
        <div className="h-1 w-full gradient-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Waitlist Management
          </CardTitle>
          <CardDescription>
            Due to security policies, waitlist entries are protected. Access via Supabase Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/30 p-5 border border-border/50">
            <p className="mb-3 font-semibold text-foreground">To access waitlist data:</p>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">1.</span>
                Go to your Supabase Dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">2.</span>
                Navigate to Table Editor → waitlist
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">3.</span>
                View and manage entries directly
              </li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2 gradient-primary" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor/29541" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Open in Supabase
              </a>
            </Button>
            <Button variant="outline" className="gap-2" disabled>
              <Send className="h-4 w-4" />
              Send Invitations
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple/10 group-hover:bg-purple/20 transition-colors">
                <Users className="h-7 w-7 text-purple" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Invite Users</h3>
                <p className="text-sm text-muted-foreground">
                  Send batch invitations to waitlist entries
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-info/10 group-hover:bg-info/20 transition-colors">
                <TrendingUp className="h-7 w-7 text-info" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">View Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Track conversion rates and signup trends
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder Table */}
      <Card className="glass-card overflow-hidden">
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
                className="pl-10 bg-background/50 border-border/50"
                disabled
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                      <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground">
                      Access waitlist entries via Supabase Dashboard
                    </p>
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <a 
                        href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor/29541" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open Dashboard
                      </a>
                    </Button>
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