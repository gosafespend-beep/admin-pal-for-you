import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownLeft, 
  UserPlus, 
  Target,
  CreditCard,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "expense" | "income" | "signup" | "goal" | "account" | "debt";
  description: string;
  amount?: number;
  timestamp: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const activityConfig = {
  expense: {
    icon: ArrowUpRight,
    bgColor: "bg-pink/10",
    iconColor: "text-pink",
    borderColor: "border-l-pink",
  },
  income: {
    icon: ArrowDownLeft,
    bgColor: "bg-primary/10",
    iconColor: "text-primary",
    borderColor: "border-l-primary",
  },
  signup: {
    icon: UserPlus,
    bgColor: "bg-info/10",
    iconColor: "text-info",
    borderColor: "border-l-info",
  },
  goal: {
    icon: Target,
    bgColor: "bg-purple/10",
    iconColor: "text-purple",
    borderColor: "border-l-purple",
  },
  account: {
    icon: CreditCard,
    bgColor: "bg-warning/10",
    iconColor: "text-warning",
    borderColor: "border-l-warning",
  },
  debt: {
    icon: TrendingUp,
    bgColor: "bg-orange/10",
    iconColor: "text-orange",
    borderColor: "border-l-orange",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg">
      <div className="h-10 w-10 rounded-full shimmer" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 shimmer rounded" />
        <div className="h-3 w-1/4 shimmer rounded" />
      </div>
    </div>
  );
}

export function RecentActivity({ activities, isLoading }: RecentActivityProps) {
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-info" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest platform events</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <>
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
              <ActivityItemSkeleton />
            </>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            activities.map((activity) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg border-l-2 bg-card/30",
                    "transition-all duration-200 hover:bg-card/50",
                    config.borderColor
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                    config.bgColor
                  )}>
                    <Icon className={cn("h-5 w-5", config.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.timestamp}
                    </p>
                  </div>
                  {activity.amount !== undefined && (
                    <span className={cn(
                      "text-sm font-semibold shrink-0",
                      activity.type === "income" ? "text-primary" : 
                      activity.type === "expense" ? "text-pink" : "text-foreground"
                    )}>
                      {activity.type === "income" ? "+" : activity.type === "expense" ? "-" : ""}
                      {formatCurrency(activity.amount)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}