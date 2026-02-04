import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CategoryDistributionChartProps {
  data: Array<{
    category: string;
    amount: number;
  }>;
  isLoading?: boolean;
}

const COLORS = [
  'hsl(160 84% 39%)',
  'hsl(180 70% 45%)',
  'hsl(200 70% 50%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(340 75% 55%)',
  'hsl(120 60% 45%)',
  'hsl(60 70% 50%)',
  'hsl(220 70% 55%)',
  'hsl(0 72% 51%)',
];

export function CategoryDistributionChart({ data, isLoading }: CategoryDistributionChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
          <CardDescription>Spending distribution by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  const chartData = data.map((item, index) => ({
    ...item,
    name: item.category.length > 12 ? item.category.slice(0, 12) + '...' : item.category,
    percentage: ((item.amount / totalAmount) * 100).toFixed(1),
    color: COLORS[index % COLORS.length],
  }));

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Top Categories</CardTitle>
        <CardDescription>Spending distribution by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="amount"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(200 22% 9%)', 
                  border: '1px solid hsl(200 15% 18%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                labelStyle={{ color: 'hsl(160 10% 95%)' }}
                formatter={(value: number) => [
                  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value),
                ]}
              />
              <Legend 
                formatter={(value) => (
                  <span style={{ color: 'hsl(200 10% 55%)', fontSize: '12px' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
