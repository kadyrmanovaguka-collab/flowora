// Free-версия по ТЗ использует "3-4 встроенных звука... Web Audio API
// с простыми синтезированными тонами" — это сознательно избавляет от
// необходимости лицензировать/хранить аудиофайлы для базового уведомления.
// Полная библиотека лоу-фай/природных треков (premium) — это уже реальные
// файлы в /public/sounds/, подключаемые отдельным плеером (см. блок с
// премиум-компонентами).

type ToneShape = "sine" | "triangle" | "square";

interface ToneStep {
  frequency: number;
  durationMs: number;
  shape?: ToneShape;
}

// Один AudioContext на вкладку: браузеры ограничивают число одновременно
// живых контекстов, и пересоздавать его на каждый звук — плохая практика.
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  // Браузеры приостанавливают AudioContext до первого жеста пользователя —
  // resume() безопасно вызывать даже если он уже running.
  if (sharedContext.state === "suspended") {
    sharedContext.resume();
  }
  return sharedContext;
}

function playTone({ frequency, durationMs, shape = "sine" }: ToneStep, startAt: number): void {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = shape;
  oscillator.frequency.value = frequency;

  // Плавный fade-in/out (envelope) вместо резкого включения/выключения —
  // без этого синтезированный тон звучит как неприятный "щелчок".
  const start = ctx.currentTime + startAt;
  const end = start + durationMs / 1000;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, end);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playSequence(steps: ToneStep[]): void {
  let offset = 0;
  for (const step of steps) {
    playTone(step, offset);
    offset += step.durationMs / 1000;
  }
}

// Набор из 4 встроенных бесплатных сигналов — пользователь выбирает один
// в настройках, значение хранится в profile (или localStorage для гостя).
export const BUILT_IN_SOUNDS = {
  chime: () => playSequence([{ frequency: 880, durationMs: 180 }, { frequency: 1320, durationMs: 260 }]),
  bell: () => playSequence([{ frequency: 660, durationMs: 500, shape: "triangle" }]),
  digital: () =>
    playSequence([
      { frequency: 1000, durationMs: 90, shape: "square" },
      { frequency: 1000, durationMs: 90, shape: "square" },
      { frequency: 1000, durationMs: 90, shape: "square" },
    ]),
  soft: () => playSequence([{ frequency: 523, durationMs: 300, shape: "sine" }, { frequency: 659, durationMs: 400, shape: "sine" }]),
} as const;

export type BuiltInSoundId = keyof typeof BUILT_IN_SOUNDS;

// Читает выбранный пользователем звук из localStorage (гостевой режим тоже
// должен слышать уведомления — поэтому не завязываемся на Supabase здесь).
export function playPhaseCompleteSound(): void {
  if (typeof window === "undefined") return;
  const soundId = (localStorage.getItem("flowora-sound-choice") as BuiltInSoundId) ?? "chime";
  const player = BUILT_IN_SOUNDS[soundId] ?? BUILT_IN_SOUNDS.chime;
  player();
}
