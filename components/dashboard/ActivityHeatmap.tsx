import { cn } from "@/lib/utils";

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number; // количество завершённых focus-сессий в этот день
}

// Чистый презентационный компонент без интерактивности — сознательно НЕ
// клиентский, рендерится на сервере вместе со страницей дашборда.
// Нативный атрибут title даёт всплывающую подсказку без единой строчки JS.
export function ActivityHeatmap({ days }: { days: HeatmapDay[] }) {
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  function intensityClass(count: number): string {
    if (count === 0) return "bg-muted";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "bg-focus";
    if (ratio > 0.5) return "bg-focus/70";
    if (ratio > 0.25) return "bg-focus/40";
    return "bg-focus/20";
  }

  // Раскладываем плоский массив дней в недели (столбцы по 7 дней) — так же,
  // как это делает GitHub: строки — дни недели, столбцы — недели года.
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {weeks.map((week, weekIdx) => (
        <div key={weekIdx} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} помодоро`}
              className={cn("h-3 w-3 rounded-sm", intensityClass(day.count))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
