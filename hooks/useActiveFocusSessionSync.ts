"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTimerStore } from "@/lib/store/timerStore";

// Мост между локальным Zustand-таймером и таблицей active_focus_sessions.
// Расширение (chrome-extension/background.js) читает эту таблицу через
// /api/sessions/active, чтобы понять, включать ли блокировку сайтов ПРЯМО
// СЕЙЧАС. Гостям (без аккаунта) синхронизация не нужна — у них просто нет
// возможности установить расширение с привязкой к своим спискам доменов.
export function useActiveFocusSessionSync() {
  const { phase, status, secondsLeft } = useTimerStore();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    const userId = userIdRef.current;
    if (!userId) return;

    const supabase = createClient();
    const isActiveFocus = phase === "focus" && status === "running";

    if (isActiveFocus) {
      const endsAt = new Date(Date.now() + secondsLeft * 1000).toISOString();
      // upsert, а не update: строка может ещё не существовать при самом
      // первом старте фокус-сессии пользователя.
      supabase.from("active_focus_sessions").upsert({ user_id: userId, ends_at: endsAt });

      // postMessage в window долетает до content-script.js расширения (если
      // оно установлено) и мгновенно, без ожидания опроса раз в 20 секунд,
      // включает блокировку сайтов. Если расширения нет — сообщение просто
      // никто не слушает, это безопасно и не требует проверки на наличие.
      window.postMessage({ source: "flowora-app", type: "FOCUS_SESSION_CHANGED", active: true, endsAt }, "*");
    } else {
      // Пауза/сброс/перерыв — блокировка должна сняться немедленно, поэтому
      // удаляем строку целиком, а не просто помечаем "неактивна": расширение
      // и так трактует отсутствие строки как "блокировки нет".
      supabase.from("active_focus_sessions").delete().eq("user_id", userId);
      window.postMessage({ source: "flowora-app", type: "FOCUS_SESSION_CHANGED", active: false, endsAt: null }, "*");
    }
    // secondsLeft намеренно НЕ в зависимостях: если добавить его, upsert
    // будет улетать в базу каждую секунду тика — а нам достаточно обновлять
    // ends_at один раз в момент старта фазы (используем состояние из
    // замыкания на момент, когда isActiveFocus стал true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status]);
}
