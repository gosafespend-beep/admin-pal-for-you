import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface UserGrowthChartProps {
  data: Array<{
    label: string;
    count: number;
  }>;
  isLoading?: boolean;
}

const BAR_COLORS = [
  'hsl(160 84% 39%)',
  'hsl(199 89% 48%)',
  'hsl(270 70% 60%)',
  'hsl(38 92% 50%)',
  'hsl(340 82% 62%)',
  'hsl(25 95% 53%)',
];

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-info" />
            User Signups
          </CardTitle>
          <CardDescription>Monthly new user registrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] shimmer rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const totalUsers = data.reduce((sum, item) => sum + item.count, 0);
  const avgMonthly = data.length > 0 ? Math.round(totalUsers / data.length) : 0;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-info" />
              User Signups
            </CardTitle>
            <CardDescription>Monthly new user registrations</CardDescription>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-info">{avgMonthly}</p>
              <p className="text-xs text-muted-foreground">Avg/Month</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {BAR_COLORS.map((color, index) => (
                  <linearGradient key={index} id={`barGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(217 33% 17%)" 
                vertical={false} 
              />
              <XAxis 
                dataKey="label" 
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(217 33% 17%)' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222 47% 9%)', 
                  border: '1px solid hsl(217 33% 17%)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}
                labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600, marginBottom: 8 }}
                cursor={{ fill: 'hsl(217 33% 17% / 0.5)' }}
                formatter={(value: number) => [value, 'New Users']}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 0, 0]}
                name="New Users"
                maxBarSize={60}
              >
                {data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#barGradient${index % BAR_COLORS.length})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}