import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EbookDailyPoint } from "@/hooks/admin/useAdminEbook";

export function EbookDailyChart({ data }: { data: EbookDailyPoint[] }) {
  const chartData = data.map((d) => ({
    day: d.day.slice(5),
    Requests: d.requests,
    Opens: d.opens,
  }));

  if (!chartData.length) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No activity in this window.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="ebookRequestsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ebookOpensFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
        />
        <Legend />
        <Area type="monotone" dataKey="Requests" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ebookRequestsFill)" />
        <Area type="monotone" dataKey="Opens" stroke="hsl(var(--info))" strokeWidth={2} fill="url(#ebookOpensFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
