import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";

interface CategoryDistributionChartProps {
  data: Array<{
    category: string;
    amount: number;
  }>;
  isLoading?: boolean;
}

const COLORS = [
  'hsl(160 84% 39%)',
  'hsl(199 89% 48%)',
  'hsl(270 70% 60%)',
  'hsl(38 92% 50%)',
  'hsl(340 82% 62%)',
  'hsl(25 95% 53%)',
  'hsl(180 60% 45%)',
  'hsl(220 70% 55%)',
  'hsl(300 60% 50%)',
  'hsl(0 84% 60%)',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function CategoryDistributionChart({ data, isLoading }: CategoryDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-purple" />
            Top Categories
          </CardTitle>
          <CardDescription>Spending distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] shimmer rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  const chartData = data.map((item, index) => ({
    ...item,
    name: item.category.length > 15 ? item.category.slice(0, 15) + '...' : item.category,
    percentage: ((item.amount / totalAmount) * 100).toFixed(1),
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-purple" />
              Top Categories
            </CardTitle>
            <CardDescription>Spending distribution by category</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">Total Tracked</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="h-[280px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={1} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="name"
                  stroke="none"
                >
                  {chartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#pieGradient${index % COLORS.length})`}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(222 47% 9%)', 
                    border: '1px solid hsl(217 33% 17%)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}
                  labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600 }}
                  formatter={(value: number, name: string) => [
                    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value),
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 justify-center min-w-[180px]">
            {chartData.slice(0, 6).map((item, index) => (
              <div key={item.category} className="flex items-center gap-3 group">
                <div 
                  className="h-3 w-3 rounded-full shrink-0 transition-transform group-hover:scale-125"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.percentage}%
                  </p>
                </div>
              </div>
            ))}
            {chartData.length > 6 && (
              <p className="text-xs text-muted-foreground mt-1">
                +{chartData.length - 6} more categories
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}