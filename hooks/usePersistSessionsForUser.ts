"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTimerStore } from "@/lib/store/timerStore";
import { checkAndUnlockAchievements } from "@/lib/achievements";

// КРИТИЧНЫЙ мост, которого раньше не было: lib/migrateGuestData.ts переносит
// накопленные локальные сессии ТОЛЬКО один раз, в момент регистрации гостя.
// Но пока залогиненный пользователь продолжает пользоваться таймером —
// новые завершённые фазы оседали только в pendingSessions (localStorage) и
// никогда не долетали до таблицы sessions. Из-за этого /dashboard, стрики
// и достижения у уже вошедшего Premium-пользователя оставались бы пустыми
// сколько угодно долго. Этот хук закрывает дыру: следит за pendingSessions
// и при каждом изменении, если пользователь залогинен, разгружает очередь
// в Supabase.
export function usePersistSessionsForUser() {
  const pendingSessions = useTimerStore((s) => s.pendingSessions);
  // userId — state, а не ref: если хранить в ref, эффект ниже не перезапустится
  // в момент, когда getUser() резолвится ПОСЛЕ того как сессия уже успела
  // завершиться и попасть в pendingSessions (обычная гонка состояний при
  // быстром первом помодоро сразу после открытия страницы) — тогда данные
  // просто зависали бы в очереди до следующего изменения pendingSessions,
  // которое могло не наступить долго. State гарантирует повторный запуск
  // эффекта именно в момент появления userId.
  const [userId, setUserId] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!userId || pendingSessions.length === 0 || isSyncingRef.current) return;

    isSyncingRef.current = true;

    (async () => {
      const supabase = createClient();
      const activeTaskId = useTimerStore.getState().activeTaskId;

      const rows = pendingSessions.map((session) => ({
        user_id: userId,
        task_id: session.type === "focus" ? activeTaskId : null,
        type: session.type,
        planned_duration_seconds: session.plannedDurationSeconds,
        actual_duration_seconds: session.actualDurationSeconds,
        completed: session.completed,
        started_at: session.startedAt,
        ended_at: session.endedAt,
      }));

      // RLS policy "sessions_insert_own" пропускает вставку только если
      // user_id каждой строки совпадает с auth.uid() текущей сессии.
      const { error } = await supabase.from("sessions").insert(rows);

      if (!error) {
        useTimerStore.getState().clearPendingSessions();
        // Проверяем достижения сразу после успешной записи новых сессий —
        // а не по отдельному таймеру/крону, поскольку именно новая
        // завершённая сессия может быть тем самым событием, что пересекает
        // порог (7 дней подряд, 100 сессий и т.д.).
        await checkAndUnlockAchievements(userId);
      } else {
        console.error("Не удалось сохранить сессии в Supabase:", error);
      }

      isSyncingRef.current = false;
    })();
  }, [pendingSessions, userId]);
}
