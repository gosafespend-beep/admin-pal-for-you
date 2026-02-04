import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Database,
  Server,
  HardDrive,
  CheckCircle,
  ExternalLink,
  Zap,
  Lock,
  Globe
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Configure admin panel and platform settings
        </p>
      </div>

      {/* System Status */}
      <Card className="glass-card overflow-hidden">
        <div className="h-1 w-full gradient-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            System Status
          </CardTitle>
          <CardDescription>
            Current status of platform services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <Database className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Database</p>
                <div className="flex items-center gap-1 text-xs text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Connected
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-info/20 bg-info/5 p-4 transition-all hover:border-info/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-info">
                <Shield className="h-5 w-5 text-info-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Authentication</p>
                <div className="flex items-center gap-1 text-xs text-info">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-info"></span>
                  </span>
                  Active
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-purple/20 bg-purple/5 p-4 transition-all hover:border-purple/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-purple">
                <HardDrive className="h-5 w-5 text-purple-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Storage</p>
                <div className="flex items-center gap-1 text-xs text-purple">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple"></span>
                  </span>
                  Available
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4 transition-all hover:border-warning/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-warning">
                <Zap className="h-5 w-5 text-warning-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Edge Functions</p>
                <div className="flex items-center gap-1 text-xs text-warning">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
                  </span>
                  Deployed
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-info" />
            Supabase Dashboard
          </CardTitle>
          <CardDescription>
            Quick access to Supabase management tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Database, label: "Table Editor", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor", color: "primary" },
              { icon: Shield, label: "Auth Users", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/auth/users", color: "info" },
              { icon: HardDrive, label: "Storage", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/storage/buckets", color: "purple" },
              { icon: Zap, label: "Edge Functions", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/functions", color: "warning" },
              { icon: Database, label: "SQL Editor", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/sql/new", color: "pink" },
              { icon: SettingsIcon, label: "Project Settings", href: "https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/settings/general", color: "orange" },
            ].map((item) => (
              <Button 
                key={item.label}
                variant="outline" 
                className="h-auto flex-col gap-3 p-5 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group" 
                asChild
              >
                <a 
                  href={item.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <item.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">{item.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/50 absolute top-3 right-3" />
                </a>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure admin notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">New User Signups</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when a new user registers
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">Waitlist Entries</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when someone joins the waitlist
              </p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">System Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Critical system alerts and warnings
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Email notifications require additional setup with a service like Resend.
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-warning" />
            Security
          </CardTitle>
          <CardDescription>
            Security settings and access control
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">Row Level Security</Label>
              <p className="text-xs text-muted-foreground">
                Database-level security policies
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              <CheckCircle className="mr-1 h-3 w-3" />
              Enabled
            </Badge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-info/5 border border-info/20">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">Admin Role Verification</Label>
              <p className="text-xs text-muted-foreground">
                Server-side role validation
              </p>
            </div>
            <Badge className="bg-info/10 text-info border border-info/20">
              <CheckCircle className="mr-1 h-3 w-3" />
              Active
            </Badge>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-purple/5 border border-purple/20">
            <div className="space-y-0.5">
              <Label className="text-foreground font-medium">Edge Function Security</Label>
              <p className="text-xs text-muted-foreground">
                Admin-only API endpoints
              </p>
            </div>
            <Badge className="bg-purple/10 text-purple border border-purple/20">
              <CheckCircle className="mr-1 h-3 w-3" />
              Protected
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}