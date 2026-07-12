import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// -----------------------------------------------------------------------------
// ТИПЫ
// -----------------------------------------------------------------------------

export type TimerPhase = "focus" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused" | "phase_transition";

export interface TimerDurations {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export interface CompletedSessionRecord {
  type: TimerPhase;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  completed: boolean;
  startedAt: string; // ISO — сериализуемо в localStorage/JSON без доп. обработки
  endedAt: string;
  taskId: string | null;
}

interface TimerState {
  // --- конфигурация ---
  durations: TimerDurations;
  activeTaskId: string | null;

  // --- runtime-состояние ---
  phase: TimerPhase;
  status: TimerStatus;
  secondsLeft: number;
  completedFocusSessionsInCycle: number; // сколько focus-сессий подряд без long break — нужно чтобы понять, когда пора long break
  phaseStartedAt: string | null;

  // --- гостевая статистика (для Free без БД) ---
  todayFocusSessions: number;
  todayFocusMinutes: number;
  lastStatsDate: string; // 'YYYY-MM-DD', чтобы сбрасывать todayFocus* при смене дня

  // --- очередь несинхронизированных сессий (гость → миграция при регистрации) ---
  pendingSessions: CompletedSessionRecord[];

  // --- 5-секундное окно отмены автоперехода в перерыв ---
  autoTransitionCancelWindow: boolean;

  // --- actions ---
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skipPhase: () => void;
  tick: () => void;
  setDurations: (durations: Partial<TimerDurations>) => void;
  setActiveTaskId: (taskId: string | null) => void;
  cancelAutoTransition: () => void;
  confirmAutoTransition: () => void;
  clearPendingSessions: () => void;
  ensureTodayStatsFresh: () => void;
}

const DEFAULT_DURATIONS: TimerDurations = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function phaseDurationSeconds(phase: TimerPhase, durations: TimerDurations): number {
  switch (phase) {
    case "focus":
      return durations.focusMinutes * 60;
    case "short_break":
      return durations.shortBreakMinutes * 60;
    case "long_break":
      return durations.longBreakMinutes * 60;
  }
}

// Определяет следующую фазу по правилам классического Pomodoro:
// после каждой focus-сессии идёт перерыв; после N-й focus-сессии подряд —
// длинный перерыв, а счётчик цикла сбрасывается.
function nextPhase(current: TimerPhase, completedFocusInCycle: number, durations: TimerDurations): TimerPhase {
  if (current !== "focus") return "focus";
  return completedFocusInCycle >= durations.sessionsBeforeLongBreak ? "long_break" : "short_break";
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      durations: DEFAULT_DURATIONS,
      activeTaskId: null,

      phase: "focus",
      status: "idle",
      secondsLeft: DEFAULT_DURATIONS.focusMinutes * 60,
      completedFocusSessionsInCycle: 0,
      phaseStartedAt: null,

      todayFocusSessions: 0,
      todayFocusMinutes: 0,
      lastStatsDate: todayKey(),

      pendingSessions: [],
      autoTransitionCancelWindow: false,

      // Запуск таймера с текущей фазы. Если это первый старт (idle) —
      // фиксируем phaseStartedAt, чтобы потом посчитать actualDurationSeconds
      // даже если пользователь сворачивал вкладку (секунды считаем по tick(),
      // а не по разнице времени — см. комментарий в tick()).
      start: () => {
        const state = get();
        if (state.status === "running") return;
        set({
          status: "running",
          phaseStartedAt: state.phaseStartedAt ?? new Date().toISOString(),
        });
      },

      pause: () => {
        if (get().status !== "running") return;
        set({ status: "paused" });
      },

      resume: () => {
        if (get().status !== "paused") return;
        set({ status: "running" });
      },

      // Полный сброс текущей фазы к её номинальной длительности без записи
      // сессии в историю — используется, когда пользователь явно передумал,
      // а не просто сделал паузу.
      reset: () => {
        const { phase, durations } = get();
        set({
          status: "idle",
          secondsLeft: phaseDurationSeconds(phase, durations),
          phaseStartedAt: null,
          autoTransitionCancelWindow: false,
        });
      },

      // Досрочный переход к следующей фазе. Текущая фаза записывается в
      // pendingSessions как completed: false (сессия прервана), чтобы
      // статистика "завершённых" помодоро не искажалась пропущенными.
      skipPhase: () => {
        const state = get();
        const plannedSeconds = phaseDurationSeconds(state.phase, state.durations);
        const actualSeconds = plannedSeconds - state.secondsLeft;

        const record: CompletedSessionRecord = {
          type: state.phase,
          plannedDurationSeconds: plannedSeconds,
          actualDurationSeconds: Math.max(0, actualSeconds),
          completed: false,
          startedAt: state.phaseStartedAt ?? new Date().toISOString(),
          endedAt: new Date().toISOString(),
          taskId: state.phase === "focus" ? state.activeTaskId : null,
        };

        const upcomingFocusCount =
          state.phase === "focus" ? state.completedFocusSessionsInCycle + 1 : state.completedFocusSessionsInCycle;
        const upcoming = nextPhase(state.phase, upcomingFocusCount, state.durations);

        set({
          pendingSessions: [...state.pendingSessions, record],
          phase: upcoming,
          status: "idle",
          secondsLeft: phaseDurationSeconds(upcoming, state.durations),
          completedFocusSessionsInCycle: upcoming === "focus" ? 0 : upcomingFocusCount,
          phaseStartedAt: null,
          autoTransitionCancelWindow: false,
        });
      },

      // Вызывается раз в секунду интервалом из компонента TimerCircle.
      // Секунды считаются декрементом счётчика, а НЕ через Date.now() - startedAt,
      // потому что таймер должен продолжать тикать в фоне (вкладка неактивна)
      // ровно так, как задумано в PWA-оффлайн режиме — Date.now() подход дал бы
      // расхождение при троттлинге таймеров браузером в неактивных вкладках,
      // а нам как раз нужно поведение "секунда = секунда" визуально при возврате.
      tick: () => {
        const state = get();
        if (state.status !== "running") return;

        if (state.secondsLeft > 1) {
          set({ secondsLeft: state.secondsLeft - 1 });
          return;
        }

        // Фаза завершена естественным образом.
        const plannedSeconds = phaseDurationSeconds(state.phase, state.durations);
        const record: CompletedSessionRecord = {
          type: state.phase,
          plannedDurationSeconds: plannedSeconds,
          actualDurationSeconds: plannedSeconds,
          completed: true,
          startedAt: state.phaseStartedAt ?? new Date().toISOString(),
          endedAt: new Date().toISOString(),
          taskId: state.phase === "focus" ? state.activeTaskId : null,
        };

        const wasFocus = state.phase === "focus";
        const upcomingFocusCount = wasFocus ? state.completedFocusSessionsInCycle + 1 : state.completedFocusSessionsInCycle;
        const upcoming = nextPhase(state.phase, upcomingFocusCount, state.durations);

        get().ensureTodayStatsFresh();

        set((s) => ({
          pendingSessions: [...s.pendingSessions, record],
          phase: upcoming,
          // "phase_transition" — переходное состояние на 5 секунд, в течение
          // которых пользователь может отменить автопереход (см. ТЗ п. Free).
          // UI в это время показывает готовящуюся следующую фазу с кнопкой отмены.
          status: "phase_transition",
          secondsLeft: phaseDurationSeconds(upcoming, s.durations),
          completedFocusSessionsInCycle: upcoming === "focus" ? 0 : upcomingFocusCount,
          phaseStartedAt: null,
          autoTransitionCancelWindow: true,
          todayFocusSessions: wasFocus ? s.todayFocusSessions + 1 : s.todayFocusSessions,
          todayFocusMinutes: wasFocus ? s.todayFocusMinutes + Math.round(plannedSeconds / 60) : s.todayFocusMinutes,
        }));

        // Автоматически подтверждаем переход через 5 секунд, если пользователь
        // не нажал "отменить". setTimeout здесь безопасен: даже если компонент
        // перемонтируется, confirmAutoTransition идемпотентен (проверяет статус).
        setTimeout(() => {
          if (get().status === "phase_transition") {
            get().confirmAutoTransition();
          }
        }, 5000);
      },

      // Пользователь нажал "отменить" в течение 5-секундного окна — таймер
      // остаётся на новой фазе, но НЕ стартует автоматически (переходит в idle).
      cancelAutoTransition: () => {
        if (!get().autoTransitionCancelWindow) return;
        set({ status: "idle", autoTransitionCancelWindow: false });
      },

      // Автоподтверждение — новая фаза стартует сама.
      confirmAutoTransition: () => {
        if (get().status !== "phase_transition") return;
        set({ status: "running", phaseStartedAt: new Date().toISOString(), autoTransitionCancelWindow: false });
      },

      setDurations: (partial) => {
        const state = get();
        const merged = { ...state.durations, ...partial };
        set({
          durations: merged,
          // Если таймер сейчас не запущен, сразу отражаем новую длительность
          // текущей фазы в обратном отсчёте — иначе пользователь поменяет
          // "25" на "50" в настройках и не увидит изменения до следующего цикла.
          secondsLeft: state.status === "idle" ? phaseDurationSeconds(state.phase, merged) : state.secondsLeft,
        });
      },

      setActiveTaskId: (taskId) => set({ activeTaskId: taskId }),

      clearPendingSessions: () => set({ pendingSessions: [] }),

      // Сбрасывает todayFocusSessions/Minutes, если наступил новый день.
      // Вызывается на tick() завершения сессии и при монтировании страницы
      // таймера — иначе счётчик "сегодня" будет расти бесконечно, если
      // вкладка была открыта с вечера на утро следующего дня.
      ensureTodayStatsFresh: () => {
        const today = todayKey();
        if (get().lastStatsDate !== today) {
          set({ todayFocusSessions: 0, todayFocusMinutes: 0, lastStatsDate: today });
        }
      },
    }),
    {
      name: "flowora-timer-storage", // ключ в localStorage — это и есть "гостевой режим" из ТЗ
      storage: createJSONStorage(() => localStorage),
      // Не сохраняем сам статус "running" между перезагрузками страницы —
      // возобновлять реально идущий отсчёт после закрытия вкладки некорректно
      // (пользователь мог закрыть браузер на час). Секунды/фазу сохраняем,
      // но таймер после reload всегда встаёт на паузу, требуя явного старта.
      partialize: (state) => ({
        ...state,
        status: state.status === "running" ? "paused" : state.status,
      }),
    }
  )
);
