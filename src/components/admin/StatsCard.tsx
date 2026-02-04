import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsVariant = "primary" | "info" | "purple" | "warning" | "pink" | "destructive" | "orange" | "default";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: StatsVariant;
}

const variantConfig: Record<StatsVariant, { 
  cardClass: string; 
  iconBg: string; 
  iconColor: string;
  glowClass: string;
}> = {
  primary: {
    cardClass: "stats-card-primary",
    iconBg: "gradient-primary",
    iconColor: "text-primary-foreground",
    glowClass: "group-hover:glow-primary",
  },
  info: {
    cardClass: "stats-card-info",
    iconBg: "gradient-info",
    iconColor: "text-info-foreground",
    glowClass: "group-hover:glow-info",
  },
  purple: {
    cardClass: "stats-card-purple",
    iconBg: "gradient-purple",
    iconColor: "text-purple-foreground",
    glowClass: "group-hover:glow-purple",
  },
  warning: {
    cardClass: "stats-card-warning",
    iconBg: "gradient-warning",
    iconColor: "text-warning-foreground",
    glowClass: "",
  },
  pink: {
    cardClass: "stats-card-pink",
    iconBg: "gradient-pink",
    iconColor: "text-pink-foreground",
    glowClass: "group-hover:glow-pink",
  },
  destructive: {
    cardClass: "stats-card-destructive",
    iconBg: "gradient-destructive",
    iconColor: "text-destructive-foreground",
    glowClass: "",
  },
  orange: {
    cardClass: "glass-card border-l-4",
    iconBg: "gradient-orange",
    iconColor: "text-orange-foreground",
    glowClass: "",
  },
  default: {
    cardClass: "glass-card",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    glowClass: "",
  },
};

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  className,
  variant = "default"
}: StatsCardProps) {
  const config = variantConfig[variant];

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
      config.cardClass,
      config.glowClass,
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight text-foreground animate-fade-in">
                {value}
              </p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5",
                    trend.isPositive 
                      ? "bg-primary/10 text-primary" 
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-110",
            config.iconBg
          )}>
            <Icon className={cn("h-7 w-7", config.iconColor)} />
          </div>
        </div>
        
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 pointer-events-none" />
      </CardContent>
    </Card>
  );
}

// Compact version for smaller spaces
export function StatsCardCompact({ 
  title, 
  value, 
  icon: Icon, 
  variant = "default",
  className 
}: Omit<StatsCardProps, 'subtitle' | 'trend'>) {
  const config = variantConfig[variant];

  return (
    <Card className={cn(
      "group transition-all duration-300 hover:scale-[1.02]",
      config.cardClass,
      className
    )}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl shadow-md",
          config.iconBg
        )}>
          <Icon className={cn("h-6 w-6", config.iconColor)} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}