"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";

// Продукт полностью бесплатный: регистрация нужна только чтобы было куда
// сохранять данные (историю, задачи, streaks), а не для разблокировки
// функций — поэтому здесь просто список того, что доступно, без сравнения
// тарифов и без чего-либо связанного с оплатой.
const FEATURES = [
  "Таймер с настройкой длительности фаз",
  "История сессий и графики фокуса по дням",
  "Heatmap-календарь активности",
  "Проекты и задачи с привязкой к фокус-сессиям",
  "Библиотека звуков для концентрации",
  "Streaks и достижения",
];

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Настройки аккаунта</h1>
          {email && <p className="mt-1 text-sm text-muted-foreground">{email}</p>}
        </div>
        <LogoutButton className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted" />
      </div>

      <section className="rounded-2xl border border-border p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Доступно вам</h2>
        <ul className="flex flex-col gap-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
