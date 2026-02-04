import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface QuickStatItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: "primary" | "info" | "purple" | "warning" | "pink" | "orange" | "destructive";
}

interface QuickStatsGridProps {
  stats: QuickStatItem[];
  isLoading?: boolean;
}

const colorConfig = {
  primary: { bg: "bg-primary/10", text: "text-primary", icon: "gradient-primary" },
  info: { bg: "bg-info/10", text: "text-info", icon: "gradient-info" },
  purple: { bg: "bg-purple/10", text: "text-purple", icon: "gradient-purple" },
  warning: { bg: "bg-warning/10", text: "text-warning", icon: "gradient-warning" },
  pink: { bg: "bg-pink/10", text: "text-pink", icon: "gradient-pink" },
  orange: { bg: "bg-orange/10", text: "text-orange", icon: "gradient-orange" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive", icon: "gradient-destructive" },
};

function QuickStatSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="h-10 w-10 rounded-xl shimmer" />
      <div className="space-y-1">
        <div className="h-3 w-16 shimmer rounded" />
        <div className="h-5 w-12 shimmer rounded" />
      </div>
    </div>
  );
}

export function QuickStatsGrid({ stats, isLoading }: QuickStatsGridProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {isLoading ? (
            <>
              <QuickStatSkeleton />
              <QuickStatSkeleton />
              <QuickStatSkeleton />
              <QuickStatSkeleton />
              <QuickStatSkeleton />
              <QuickStatSkeleton />
            </>
          ) : (
            stats.map((stat, index) => {
              const config = colorConfig[stat.color];
              const Icon = stat.icon;

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/30 hover:bg-card/50 transition-colors"
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    config.icon
                  )}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={cn("text-lg font-bold", config.text)}>{stat.value}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}