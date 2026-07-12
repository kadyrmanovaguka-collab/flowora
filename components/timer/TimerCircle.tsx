"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useTimerStore } from "@/lib/store/timerStore";
import { cn } from "@/lib/utils";
import { playPhaseCompleteSound } from "@/lib/audio";

// Геометрия SVG-окружности вынесена в константы: радиус влияет на длину
// окружности (stroke-dasharray), а она должна быть согласована с viewBox —
// проще держать оба числа рядом, чем пересчитывать в голове при правках.
const SIZE = 320;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PHASE_LABELS: Record<string, string> = {
  focus: "Фокус",
  short_break: "Короткий перерыв",
  long_break: "Длинный перерыв",
};

// Tailwind-классы цвета обводки по фазе — используют CSS-переменные из
// globals.css (--focus/--short-break/--long-break), чтобы тема (свет/тьма)
// автоматически подхватывалась без дублирования логики здесь.
const PHASE_STROKE_CLASS: Record<string, string> = {
  focus: "stroke-focus",
  short_break: "stroke-short-break",
  long_break: "stroke-long-break",
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TimerCircle() {
  const {
    phase,
    status,
    secondsLeft,
    durations,
    tick,
    ensureTodayStatsFresh,
  } = useTimerStore();

  // Используем ref для отслеживания предыдущей фазы, чтобы сыграть звук
  // РОВНО в момент смены фазы (phase_transition), а не на каждый ре-рендер.
  const prevStatusRef = useRef(status);

  useEffect(() => {
    ensureTodayStatsFresh();
  }, [ensureTodayStatsFresh]);

  // Единственный интервал на весь таймер. setInterval, а не requestAnimationFrame,
  // потому что нам не нужна анимация каждый кадр — только раз в секунду,
  // а setInterval продолжает вызываться (пусть и с троттлингом браузера)
  // даже в неактивной вкладке, что и требуется для PWA-фонового отсчёта.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(id);
  }, [status, tick]);

  useEffect(() => {
    if (status === "phase_transition" && prevStatusRef.current !== "phase_transition") {
      playPhaseCompleteSound();
    }
    prevStatusRef.current = status;
  }, [status]);

  const totalPhaseSeconds = useMemo(() => {
    switch (phase) {
      case "focus":
        return durations.focusMinutes * 60;
      case "short_break":
        return durations.shortBreakMinutes * 60;
      case "long_break":
        return durations.longBreakMinutes * 60;
    }
  }, [phase, durations]);

  const progress = 1 - secondsLeft / totalPhaseSeconds;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {/* Фоновая окружность — статичный "трек", по которому едет прогресс */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          className="stroke-muted fill-none"
        />
        {/* Прогресс-окружность. stroke-dasharray = вся длина окружности,
            stroke-dashoffset уменьшается по мере прохождения времени —
            классический SVG-приём для кругового прогресс-бара. */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className={cn("fill-none transition-colors duration-500", PHASE_STROKE_CLASS[phase])}
          style={{ strokeDasharray: CIRCUMFERENCE }}
          // initial обязателен: без него Framer Motion не знает, с какого
          // значения стартовать анимацию strokeDashoffset при самом первом
          // рендере, и ругается в консоль "animate from undefined". Полный
          // круг (смещение = 0% прогресса) — естественная стартовая точка.
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          // linear + duration 1s синхронизирует анимацию с интервалом тика:
          // каждую секунду обводка плавно "довращивается" ровно на 1/N дуги,
          // вместо резкого скачка, который выглядел бы дёргано.
          transition={{ duration: 1, ease: "linear" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span className="timer-digits text-6xl font-semibold tabular-nums">
          {formatTime(secondsLeft)}
        </span>
        <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {PHASE_LABELS[phase]}
        </span>
      </div>
    </div>
  );
}
