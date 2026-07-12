import { createClient } from "@/lib/supabase/client";
import { useTimerStore } from "@/lib/store/timerStore";

// Реализует п.3 общей логики из ТЗ: "при регистрации локальные данные из
// localStorage мигрируют в Supabase (один раз, при первом входе)".
// Флаг profiles.guest_data_migrated не даёт этому случиться повторно, если
// пользователь зайдёт с того же браузера ещё раз (иначе задвоили бы историю).
export async function migrateGuestDataIfNeeded(userId: string): Promise<void> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("guest_data_migrated")
    .eq("id", userId)
    .single();

  if (!profile || profile.guest_data_migrated) return;

  const pendingSessions = useTimerStore.getState().pendingSessions;

  if (pendingSessions.length > 0) {
    const rows = pendingSessions.map((session) => ({
      user_id: userId,
      task_id: null, // у гостя не может быть задач (это premium-функция) — переносить нечего
      type: session.type,
      planned_duration_seconds: session.plannedDurationSeconds,
      actual_duration_seconds: session.actualDurationSeconds,
      completed: session.completed,
      started_at: session.startedAt,
      ended_at: session.endedAt,
    }));

    // RLS policy "sessions_insert_own" пропустит вставку только если
    // user_id каждой строки совпадает с auth.uid() — то есть с только что
    // залогинившимся пользователем, что здесь и есть.
    const { error } = await supabase.from("sessions").insert(rows);
    if (!error) {
      useTimerStore.getState().clearPendingSessions();
    }
  }

  await supabase.from("profiles").update({ guest_data_migrated: true }).eq("id", userId);
}
