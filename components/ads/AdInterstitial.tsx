"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const AD_WINDOW_SECONDS = 5;

// Полноэкранная заставка на те самые 5 секунд, что раньше использовались
// только под окно отмены автоперехода (см. lib/store/timerStore.ts —
// status: "phase_transition"). Сама пауза и её длительность не менялись,
// просто теперь в это время показывается рекламный слот вместо пустого
// экрана. Кнопка отмены автоперехода сохранена — это НЕ "закрыть рекламу",
// а прежний функционал "не хочу начинать перерыв/фокус прямо сейчас".
//
// ==========================================================================
// КАК ПОДКЛЮЧИТЬ РЕАЛЬНУЮ РЕКЛАМНУЮ СЕТЬ (сейчас здесь плейсхолдер):
// ==========================================================================
// Google AdSense (нужен одобренный аккаунт + опубликованный домен, не
// работает на localhost):
//   1. Подключить скрипт AdSense в app/layout.tsx:
//      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX" crossOrigin="anonymous" />
//   2. Заменить блок AD PLACEHOLDER ниже на:
//      <ins className="adsbygoogle" style={{ display: "block" }}
//           data-ad-client="ca-pub-XXXXXXXXXX" data-ad-slot="XXXXXXXXXX"
//           data-ad-format="auto" data-full-width-responsive="true" />
//      и вызвать (window.adsbygoogle = window.adsbygoogle || []).push({}) в useEffect.
// Другие сети (например, отечественные РСЯ/Яндекс.Директ) работают по
// похожему принципу — вставляется их skriptless-тег вместо блока ниже.
// ==========================================================================
export function AdInterstitial({ onCancel }: { onCancel: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(AD_WINDOW_SECONDS);

  // Чисто косметический локальный отсчёт для UI — реальное время паузы
  // и автоперехода управляется таймером в timerStore (setTimeout 5000ms),
  // этот countdown ему не мешает и с ним не связан напрямую.
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <button
        onClick={onCancel}
        aria-label="Отменить автопереход и закрыть"
        className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" /> Отменить переход
      </button>

      {/* ============ AD PLACEHOLDER — замените на реальный рекламный блок ============ */}
      <div className="flex h-80 w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Реклама</span>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Здесь будет показываться рекламный блок (например Google AdSense).
          Пока это заглушка для разработки.
        </p>
      </div>
      {/* ============ конец AD PLACEHOLDER ============ */}

      <p className="text-xs text-muted-foreground">
        Следующая фаза начнётся автоматически через {secondsLeft} сек…
      </p>
    </div>
  );
}
