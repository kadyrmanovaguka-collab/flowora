import { createClient } from "@/lib/supabase/server";
import { FocusLineChart, type DailyFocusPoint } from "@/components/dashboard/FocusLineChart";
import { ActivityHeatmap, type HeatmapDay } from "@/components/dashboard/ActivityHeatmap";
import { ProjectPieChart, type ProjectSlice } from "@/components/dashboard/ProjectPieChart";
import { StreakBadges } from "@/components/dashboard/StreakBadges";
import { computeStreakFromDates } from "@/lib/achievements";

// Без этого Next.js может отдать закэшированный рендер страницы (Router Cache
// на клиенте + возможное статическое кэширование на сервере), в котором
// данные из sessions ещё не учитывают только что завершённую сессию —
// ровно то же семейство бага, что было с кнопкой "Войти" на /pricing.
// Дашборд должен ВСЕГДА отражать текущее состояние базы при заходе.
export const dynamic = "force-dynamic";

const LINE_CHART_DAYS = 30;
const HEATMAP_DAYS = 119; // 17 полных недель — визуально похоже на GitHub contributions

interface SessionWithRelations {
  started_at: string;
  actual_duration_seconds: number;
  task: { name: string; project: { name: string; color: string } | null } | null;
}

// Server Component: вся тяжёлая агрегация данных происходит на сервере,
// на клиент уходят только уже посчитанные точки для графиков — это и быстрее
// (меньше JS/данных по сети), и безопаснее (сырые строки sessions не палятся
// в devtools клиента без необходимости).
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // middleware уже должен был отредиректить раньше

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HEATMAP_DAYS);

  // RLS policy "sessions_select_own" гарантирует, что этот запрос вернёт
  // только сессии текущего пользователя, даже без явного .eq('user_id', ...) —
  // но добавляем его явно для читаемости и на случай будущих изменений policy.
  const { data: sessions } = await supabase
    .from("sessions")
    .select("started_at, actual_duration_seconds, task:tasks(name, project:projects(name, color))")
    .eq("user_id", user.id)
    .eq("type", "focus")
    .eq("completed", true)
    .gte("started_at", cutoff.toISOString())
    .returns<SessionWithRelations[]>();

  const rows = sessions ?? [];

  const { data: unlockedAchievements } = await supabase
    .from("achievements")
    .select("achievement_key")
    .eq("user_id", user.id)
    .returns<{ achievement_key: string }[]>();

  const currentStreak = computeStreakFromDates(rows.map((r) => r.started_at.slice(0, 10)));

  const { lineData, heatmapData, pieData } = aggregate(rows);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Дашборд</h1>

      <Card title="Стрик и достижения">
        <StreakBadges
          currentStreak={currentStreak}
          unlockedKeys={(unlockedAchievements ?? []).map((a) => a.achievement_key)}
        />
      </Card>

      <Card title="Минуты в фокусе за последние 30 дней">
        <FocusLineChart data={lineData} />
      </Card>

      <Card title="Активность за последние 17 недель">
        <ActivityHeatmap days={heatmapData} />
      </Card>

      <Card title="Распределение по проектам">
        <ProjectPieChart data={pieData} />
      </Card>
    </div>
  );
}

function aggregate(rows: SessionWithRelations[]) {
  const now = new Date();

  // --- линейный график: последние 30 дней, с нулями для дней без сессий ---
  const minutesByDate = new Map<string, number>();
  const projectMinutes = new Map<string, { minutes: number; color: string }>();

  for (const row of rows) {
    const dateKey = row.started_at.slice(0, 10);
    const minutes = Math.round(row.actual_duration_seconds / 60);

    minutesByDate.set(dateKey, (minutesByDate.get(dateKey) ?? 0) + minutes);

    const projectName = row.task?.project?.name ?? "Без проекта";
    const projectColor = row.task?.project?.color ?? "#9ca3af";
    const existing = projectMinutes.get(projectName);
    projectMinutes.set(projectName, {
      minutes: (existing?.minutes ?? 0) + minutes,
      color: projectColor,
    });
  }

  const lineData: DailyFocusPoint[] = [];
  for (let i = LINE_CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    lineData.push({
      date: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      minutes: minutesByDate.get(key) ?? 0,
    });
  }

  // --- heatmap: считаем количество сессий (не минут) за каждый день периода ---
  const sessionsCountByDate = new Map<string, number>();
  for (const row of rows) {
    const key = row.started_at.slice(0, 10);
    sessionsCountByDate.set(key, (sessionsCountByDate.get(key) ?? 0) + 1);
  }

  const heatmapData: HeatmapDay[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    heatmapData.push({ date: key, count: sessionsCountByDate.get(key) ?? 0 });
  }

  const pieData: ProjectSlice[] = Array.from(projectMinutes.entries()).map(([name, { minutes, color }]) => ({
    name,
    minutes,
    color,
  }));

  return { lineData, heatmapData, pieData };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-6">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}
