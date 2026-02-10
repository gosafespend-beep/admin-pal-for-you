import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ClipboardList, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "@/hooks/admin/useAdminDashboardStats";

interface DashboardAlertsProps {
  stats: DashboardStats;
}

export function DashboardAlerts({ stats }: DashboardAlertsProps) {
  const alerts: { icon: React.ElementType; text: string; link: string; color: string }[] = [];

  // Expiring trials (trialing subs that need attention)
  if (stats.subscriptions.trialing > 0) {
    alerts.push({
      icon: Clock,
      text: `${stats.subscriptions.trialing} users currently on trial`,
      link: "/admin/subscriptions",
      color: "text-info",
    });
  }

  // Pending waitlist
  if (stats.overview.waitlistCount > 0) {
    alerts.push({
      icon: ClipboardList,
      text: `${stats.overview.waitlistCount} waitlist entries pending`,
      link: "/admin/waitlist",
      color: "text-warning",
    });
  }

  // High churn indicator
  if (stats.subscriptions.cancelled > 0) {
    alerts.push({
      icon: AlertTriangle,
      text: `${stats.subscriptions.cancelled} cancelled subscriptions`,
      link: "/admin/analytics",
      color: "text-destructive",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="glass-card border-l-4 border-l-warning">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 shrink-0">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Action Needed</p>
            <div className="flex flex-wrap gap-2">
              {alerts.map((alert, i) => (
                <Link
                  key={i}
                  to={alert.link}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-card/50 border border-border/30 hover:bg-muted/50 transition-colors"
                >
                  <alert.icon className={`h-3 w-3 ${alert.color}`} />
                  <span className="text-muted-foreground">{alert.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
