import { createClient } from "@/lib/supabase/client";

export interface AchievementDef {
  key: string;
  label: string;
  description: string;
}

// Единый источник правды для списка достижений — используется и при
// разблокировке (проверке порогов), и при отрисовке бейджей на дашборде.
export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "streak_7", label: "Неделя фокуса", description: "7 дней подряд хотя бы одна фокус-сессия" },
  { key: "streak_30", label: "Месяц дисциплины", description: "30 дней подряд хотя бы одна фокус-сессия" },
  { key: "sessions_100", label: "Сотня помодоро", description: "100 завершённых фокус-сессий" },
];

// Чистая функция без побочных эффектов — специально не завязана на
// Supabase-клиент, чтобы её можно было использовать и в Server Component
// дашборда (там даты уже под рукой из другого запроса), и на клиенте.
export function computeStreakFromDates(dates: string[]): number {
  const days = new Set(dates);
  let streak = 0;
  const cursor = new Date();

  // Если сегодня ещё не было сессии, это не должно обнулять стрик —
  // человек мог просто ещё не успел позаниматься сегодня. Начинаем отсчёт
  // со вчерашнего дня в этом случае.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// Вызывается с клиента (usePersistSessionsForUser) сразу после того как
// новые сессии успешно улетели в Supabase — именно в этот момент могла
// произойти разблокировка (например ровно 7-й день подряд).
export async function checkAndUnlockAchievements(userId: string): Promise<void> {
  const supabase = createClient();

  const [{ data: sessionDates }, { count: totalFocusSessions }, { data: alreadyUnlocked }] = await Promise.all([
    supabase
      .from("sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("type", "focus")
      .eq("completed", true)
      .returns<{ started_at: string }[]>(),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "focus")
      .eq("completed", true),
    supabase
      .from("achievements")
      .select("achievement_key")
      .eq("user_id", userId)
      .returns<{ achievement_key: string }[]>(),
  ]);

  const streak = computeStreakFromDates((sessionDates ?? []).map((r) => r.started_at.slice(0, 10)));
  const unlockedKeys = new Set((alreadyUnlocked ?? []).map((a) => a.achievement_key));
  const toUnlock: string[] = [];

  if (streak >= 7 && !unlockedKeys.has("streak_7")) toUnlock.push("streak_7");
  if (streak >= 30 && !unlockedKeys.has("streak_30")) toUnlock.push("streak_30");
  if ((totalFocusSessions ?? 0) >= 100 && !unlockedKeys.has("sessions_100")) toUnlock.push("sessions_100");

  if (toUnlock.length > 0) {
    // unique(user_id, achievement_key) в схеме не даст вставить дубликат,
    // даже если бы эта функция случайно вызвалась дважды параллельно.
    await supabase.from("achievements").insert(toUnlock.map((key) => ({ user_id: userId, achievement_key: key })));
  }
}
