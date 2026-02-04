import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend 
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface TransactionChartProps {
  data: Array<{
    label: string;
    expenses: number;
    income: number;
  }>;
  isLoading?: boolean;
}

export function TransactionVolumeChart({ data, isLoading }: TransactionChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Transaction Volume
          </CardTitle>
          <CardDescription>Monthly expenses vs income</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] shimmer rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
  const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
  const netFlow = totalIncome - totalExpenses;

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Transaction Volume
            </CardTitle>
            <CardDescription>Monthly cash flow analysis</CardDescription>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${netFlow >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {netFlow >= 0 ? '+' : ''}{new Intl.NumberFormat('en-KE', { 
                style: 'currency', 
                currency: 'KES',
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(netFlow)}
            </p>
            <p className="text-xs text-muted-foreground">Net Flow</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(340 82% 62%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(340 82% 62%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                </linearGradient>
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
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222 47% 9%)', 
                  border: '1px solid hsl(217 33% 17%)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}
                labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 600, marginBottom: 8 }}
                formatter={(value: number, name: string) => [
                  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(value),
                  name === 'income' ? 'Income' : 'Expenses'
                ]}
              />
              <Legend 
                formatter={(value) => (
                  <span style={{ color: 'hsl(215 20% 55%)', fontSize: '12px', textTransform: 'capitalize' }}>{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(160 84% 39%)"
                strokeWidth={3}
                fill="url(#incomeGradient)"
                name="income"
                dot={{ fill: 'hsl(160 84% 39%)', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(160 84% 39%)', stroke: 'hsl(160 84% 39%)', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(340 82% 62%)"
                strokeWidth={3}
                fill="url(#expenseGradient)"
                name="expenses"
                dot={{ fill: 'hsl(340 82% 62%)', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(340 82% 62%)', stroke: 'hsl(340 82% 62%)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}