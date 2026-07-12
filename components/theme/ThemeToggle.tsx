"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "flowora-theme";

// Тема хранится в localStorage (а не только в profiles.theme из базы),
// потому что должна работать и для гостя без аккаунта — тот же паттерн,
// что и у гостевого режима таймера. Если пользователь залогинен, можно
// было бы дополнительно синхронизировать с Supabase, но для базового
// переключателя localStorage достаточен и не требует лишнего round-trip.
export function ThemeToggle() {
  // isDark изначально null, а не boolean: до монтирования на клиенте мы не
  // знаем реальное состояние (оно уже применено инлайн-скриптом в
  // app/layout.tsx до гидратации) — null удерживает кнопку от "мигания"
  // неправильной иконкой на долю секунды.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    setIsDark(next);
  }

  if (isDark === null) {
    // Место-заглушка того же размера, чтобы не "прыгала" верстка шапки
    // пока идёт определение реального состояния на клиенте.
    return <span className="h-8 w-8" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
