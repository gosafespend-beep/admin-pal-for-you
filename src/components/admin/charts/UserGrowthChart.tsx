import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UserGrowthChartProps {
  data: Array<{
    label: string;
    count: number;
  }>;
  isLoading?: boolean;
}

export function UserGrowthChart({ data, isLoading }: UserGrowthChartProps) {
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>User Signups</CardTitle>
          <CardDescription>Monthly new user registrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>User Signups</CardTitle>
        <CardDescription>Monthly new user registrations over the past year</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 15% 18%)" vertical={false} />
              <XAxis 
                dataKey="label" 
                tick={{ fill: 'hsl(200 10% 55%)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(200 15% 18%)' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(200 10% 55%)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(200 22% 9%)', 
                  border: '1px solid hsl(200 15% 18%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                labelStyle={{ color: 'hsl(160 10% 95%)' }}
                cursor={{ fill: 'hsl(200 15% 15%)' }}
              />
              <Bar
                dataKey="count"
                fill="hsl(160 84% 39%)"
                radius={[4, 4, 0, 0]}
                name="New Users"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
