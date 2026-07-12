"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface DailyFocusPoint {
  date: string; // 'MMM d' — уже отформатировано на сервере, чтобы не тащить date-fns в клиентский бандл дважды
  minutes: number;
}

// Client Component: recharts использует canvas/svg measurement, которые
// требуют браузерного окружения — обёртка вокруг серверных данных.
export function FocusLineChart({ data }: { data: DailyFocusPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value: number) => [`${value} мин`, "В фокусе"]}
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="minutes"
          stroke="hsl(var(--focus))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
