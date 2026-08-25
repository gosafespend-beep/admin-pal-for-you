import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventTrendPoint } from "@/hooks/admin/useAdminAnalytics";

export function EventTrendChart({ data, eventFilter }: { data: EventTrendPoint[]; eventFilter: string }) {
  const chartData = data.map((d) => ({
    day: d.day.slice(5),
    value: eventFilter === "all" ? d.total : d.events[eventFilter] ?? 0,
  }));

  if (!chartData.length) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No events in this window.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="eventTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#eventTrendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
