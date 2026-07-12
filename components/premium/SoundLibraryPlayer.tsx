"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Repeat } from "lucide-react";
import { SOUND_LIBRARY, SOUND_CATEGORY_LABELS, type SoundTrack } from "@/lib/soundLibrary";
import { cn } from "@/lib/utils";

// Premium-функция: полная библиотека лоу-фай/природных треков с плеером —
// громкость, зацикливание, работает во время фокус-сессии (пользователь
// может запустить трек и продолжать работать, звук не завязан на фазу таймера).
export function SoundLibraryPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTrack, setActiveTrack] = useState<SoundTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isLooping, setIsLooping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = isLooping;
  }, [isLooping]);

  function handleTrackClick(track: SoundTrack) {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);

    if (activeTrack?.id === track.id) {
      // Повторный клик по уже играющему треку — пауза/резюм, а не перезапуск.
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch((err) => {
          console.error("Ошибка воспроизведения:", err);
          setError("Не удалось воспроизвести трек");
        });
        setIsPlaying(true);
      }
      return;
    }

    audio.src = track.src;
    audio.loop = isLooping;
    audio.volume = volume;
    audio.play().catch((err) => {
      // Раньше ошибка проглатывалась молча — теперь видна и в консоли,
      // и прямо в интерфейсе, чтобы можно было понять причину: файл
      // отсутствует по указанному пути (404), битый/невалидный mp3,
      // или браузер заблокировал автовоспроизведение.
      console.error(`Не удалось воспроизвести ${track.src}:`, err);
      setError(`Не удалось воспроизвести «${track.name}» — проверьте, что файл ${track.src} существует`);
      setIsPlaying(false);
    });
    setActiveTrack(track);
    setIsPlaying(true);
  }

  const groupedByCategory = SOUND_LIBRARY.reduce<Record<string, SoundTrack[]>>((acc, track) => {
    (acc[track.category] ??= []).push(track);
    return acc;
  }, {});

  return (
    <div className="w-full max-w-md rounded-2xl border border-border p-4">
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          // Срабатывает и на 404, и на битый файл, и на неподдерживаемый
          // кодек — событие error на <audio> надёжнее, чем полагаться
          // только на отказ .play(), которая иногда резолвится "успешно"
          // до того как браузер поймёт, что грузить нечего.
          console.error("Audio element error, src:", audioRef.current?.src);
          setError(activeTrack ? `Файл для «${activeTrack.name}» не найден или повреждён` : "Ошибка загрузки аудио");
          setIsPlaying(false);
        }}
      />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Звуки для концентрации</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLooping((v) => !v)}
            title="Зациклить"
            className={cn("rounded-full p-1.5", isLooping ? "text-primary" : "text-muted-foreground")}
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 accent-primary"
            />
          </div>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      <div className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
        {Object.entries(groupedByCategory).map(([category, tracks]) => (
          <div key={category}>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {SOUND_CATEGORY_LABELS[category as SoundTrack["category"]]}
            </p>
            <div className="flex flex-col gap-1">
              {tracks.map((track) => {
                const isActive = activeTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => handleTrackClick(track)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    {isActive && isPlaying ? (
                      <Pause className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Play className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {track.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
