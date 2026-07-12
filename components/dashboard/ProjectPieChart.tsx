"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface ProjectSlice {
  name: string;
  minutes: number;
  color: string;
}

export function ProjectPieChart({ data }: { data: ProjectSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Пока нет сессий, привязанных к проектам
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="minutes" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
          {data.map((entry) => (
            // Цвет берётся из projects.color (пользовательская настройка проекта),
            // а не из фиксированной палитры — так пирог визуально совпадает
            // с цветными метками проектов на странице /tasks.
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} мин`, "Время"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
