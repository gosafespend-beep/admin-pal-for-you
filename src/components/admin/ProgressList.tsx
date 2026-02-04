import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressItem {
  label: string;
  value: number;
  max: number;
  color: "primary" | "info" | "purple" | "warning" | "pink" | "orange";
}

interface ProgressListProps {
  title: string;
  items: ProgressItem[];
  isLoading?: boolean;
}

const colorClasses = {
  primary: "bg-primary",
  info: "bg-info",
  purple: "bg-purple",
  warning: "bg-warning",
  pink: "bg-pink",
  orange: "bg-orange",
};

export function ProgressList({ title, items, isLoading }: ProgressListProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 space-y-4">
          <div className="h-6 w-32 shimmer rounded" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 shimmer rounded" />
              <div className="h-2 w-full shimmer rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="space-y-4">
          {items.map((item, index) => {
            const percentage = (item.value / item.max) * 100;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">
                    {item.value.toLocaleString()} / {item.max.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      colorClasses[item.color]
                    )}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}