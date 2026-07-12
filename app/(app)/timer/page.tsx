"use client";

import { useEffect, useState } from "react";
import { useTimerStore } from "@/lib/store/timerStore";
import { TimerCircle } from "@/components/timer/TimerCircle";
import { TimerControls } from "@/components/timer/TimerControls";
import { BUILT_IN_SOUNDS, type BuiltInSoundId } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useActiveFocusSessionSync } from "@/hooks/useActiveFocusSessionSync";
import { useGuestDataMigration } from "@/hooks/useGuestDataMigration";
import { usePersistSessionsForUser } from "@/hooks/usePersistSessionsForUser";
import { SoundLibraryPlayer } from "@/components/premium/SoundLibraryPlayer";
import { createClient } from "@/lib/supabase/client";

const SOUND_LABELS: Record<BuiltInSoundId, string> = {
  chime: "Колокольчик",
  bell: "Гонг",
  digital: "Цифровой",
  soft: "Мягкий",
};

export default function TimerPage() {
  const { durations, setDurations, status, todayFocusSessions, todayFocusMinutes } = useTimerStore();

  const [selectedSound, setSelectedSound] = useState<BuiltInSoundId>("chime");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Продукт больше не разделён на Free/Premium — всё доступно любому
  // залогиненному пользователю. Гостям (без аккаунта) доступен только сам
  // таймер, а история/задачи/библиотека звуков требуют регистрации —
  // именно чтобы было куда сохранять их данные, а не как способ монетизации.
  const isLoggedIn = !!userId;

  useActiveFocusSessionSync();
  useGuestDataMigration();
  // Без этого хука завершённые сессии залогиненного пользователя копились бы
  // только в localStorage и никогда не попадали в Supabase — а значит
  // дашборд/стрики/достижения оставались бы пустыми даже у зарегистрированного.
  usePersistSessionsForUser();

  // Читаем сохранённый звук один раз на клиенте (localStorage недоступен
  // при серверном рендере, поэтому это не может быть initial state напрямую).
  useEffect(() => {
    const saved = localStorage.getItem("flowora-sound-choice") as BuiltInSoundId | null;
    if (saved && saved in BUILT_IN_SOUNDS) setSelectedSound(saved);
  }, []);

  function handleSoundChange(id: BuiltInSoundId) {
    setSelectedSound(id);
    localStorage.setItem("flowora-sound-choice", id);
    BUILT_IN_SOUNDS[id](); // сразу проигрываем превью, чтобы пользователь услышал выбор
  }

  const isEditingDisabled = status === "running" || status === "phase_transition";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10">
      <TimerCircle />
      <TimerControls />

      <div className="flex gap-8 text-center">
        <div>
          <p className="text-2xl font-semibold">{todayFocusSessions}</p>
          <p className="text-xs text-muted-foreground">помодоро сегодня</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{todayFocusMinutes}</p>
          <p className="text-xs text-muted-foreground">минут в фокусе</p>
        </div>
      </div>

      <div className={cn("grid w-full max-w-md grid-cols-3 gap-4", isEditingDisabled && "pointer-events-none opacity-50")}>
        <DurationInput
          label="Фокус"
          value={durations.focusMinutes}
          onChange={(v) => setDurations({ focusMinutes: v })}
        />
        <DurationInput
          label="Короткий перерыв"
          value={durations.shortBreakMinutes}
          onChange={(v) => setDurations({ shortBreakMinutes: v })}
        />
        <DurationInput
          label="Длинный перерыв"
          value={durations.longBreakMinutes}
          onChange={(v) => setDurations({ longBreakMinutes: v })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="mr-2 text-sm text-muted-foreground">Звук уведомления:</span>
        {(Object.keys(BUILT_IN_SOUNDS) as BuiltInSoundId[]).map((id) => (
          <button
            key={id}
            onClick={() => handleSoundChange(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              selectedSound === id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            )}
          >
            {SOUND_LABELS[id]}
          </button>
        ))}
      </div>

      {isLoggedIn ? (
        <SoundLibraryPlayer />
      ) : (
        <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
          <p className="font-medium">Зарегистрируйтесь, чтобы сохранить прогресс 🎉</p>
          <p className="mt-1 text-muted-foreground">
            История сессий, задачи, дашборд и полная библиотека звуков — бесплатно,
            нужен только аккаунт, чтобы было куда сохранять ваши данные.
          </p>
          <a href="/login" className="mt-3 inline-block font-medium text-primary hover:underline">
            Зарегистрироваться →
          </a>
        </div>
      )}
    </div>
  );
}

function DurationInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 text-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min={1}
        max={180}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed) && parsed > 0) onChange(parsed);
        }}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-center text-sm"
      />
    </label>
  );
}
