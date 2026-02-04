import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Database,
  Server,
  HardDrive,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Configure admin panel and platform settings
        </p>
      </div>

      {/* System Status */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current status of platform services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Authentication</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Storage</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Edge Functions</p>
                <p className="text-xs text-muted-foreground">Deployed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Supabase Dashboard
          </CardTitle>
          <CardDescription>
            Quick access to Supabase management tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/editor" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Database className="h-5 w-5" />
                <span className="text-sm">Table Editor</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/auth/users" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Shield className="h-5 w-5" />
                <span className="text-sm">Auth Users</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/storage/buckets" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <HardDrive className="h-5 w-5" />
                <span className="text-sm">Storage</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/functions" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Server className="h-5 w-5" />
                <span className="text-sm">Edge Functions</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/sql/new" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Database className="h-5 w-5" />
                <span className="text-sm">SQL Editor</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <a 
                href="https://supabase.com/dashboard/project/qeogqvjqvafbzufanwki/settings/general" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <SettingsIcon className="h-5 w-5" />
                <span className="text-sm">Project Settings</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure admin notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New User Signups</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when a new user registers
              </p>
            </div>
            <Switch disabled />
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Waitlist Entries</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when someone joins the waitlist
              </p>
            </div>
            <Switch disabled />
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Critical system alerts and warnings
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Note: Email notifications require additional setup with a service like Resend.
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Security settings and access control
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Row Level Security</Label>
              <p className="text-xs text-muted-foreground">
                Database-level security policies
              </p>
            </div>
            <Badge variant="default" className="bg-primary/10 text-primary">
              <CheckCircle className="mr-1 h-3 w-3" />
              Enabled
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Admin Role Verification</Label>
              <p className="text-xs text-muted-foreground">
                Server-side role validation
              </p>
            </div>
            <Badge variant="default" className="bg-primary/10 text-primary">
              <CheckCircle className="mr-1 h-3 w-3" />
              Active
            </Badge>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Edge Function Security</Label>
              <p className="text-xs text-muted-foreground">
                Admin-only API endpoints
              </p>
            </div>
            <Badge variant="default" className="bg-primary/10 text-primary">
              <CheckCircle className="mr-1 h-3 w-3" />
              Protected
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
