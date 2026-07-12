"use client";

import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { useTimerStore } from "@/lib/store/timerStore";
import { cn } from "@/lib/utils";
import { AdInterstitial } from "@/components/ads/AdInterstitial";

// Простая обёртка-кнопка без зависимости от полноценного shadcn Button —
// у этого блока намеренно минимальная вёрстка, чтобы не тянуть сюда весь
// набор UI-примитивов раньше времени; полноценные shadcn-компоненты
// подключаются в блоке с layout приложения.
function ControlButton({
  onClick,
  children,
  variant = "secondary",
  ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95",
        variant === "primary" && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" && "text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export function TimerControls() {
  const { status, start, pause, resume, reset, skipPhase, cancelAutoTransition } = useTimerStore();

  // Во время 5-секундного окна после завершения фазы показываем полноэкранную
  // рекламную заставку (см. components/ads/AdInterstitial.tsx) — сама пауза
  // и возможность отменить автопереход не изменились, просто теперь в этом
  // окне показывается рекламный слот вместо пустого экрана.
  if (status === "phase_transition") {
    return <AdInterstitial onCancel={cancelAutoTransition} />;
  }

  return (
    <div className="flex items-center gap-4">
      <ControlButton onClick={reset} variant="ghost" ariaLabel="Сбросить таймер">
        <RotateCcw className="h-5 w-5" />
      </ControlButton>

      {status === "running" ? (
        <ControlButton onClick={pause} variant="primary" ariaLabel="Поставить на паузу">
          <Pause className="h-6 w-6" />
        </ControlButton>
      ) : (
        <ControlButton
          onClick={status === "paused" ? resume : start}
          variant="primary"
          ariaLabel="Запустить таймер"
        >
          <Play className="ml-0.5 h-6 w-6" />
        </ControlButton>
      )}

      <ControlButton onClick={skipPhase} variant="ghost" ariaLabel="Пропустить фазу">
        <SkipForward className="h-5 w-5" />
      </ControlButton>
    </div>
  );
}
