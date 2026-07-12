import Link from "next/link";
import { CheckCircle2, Timer, BarChart3, ShieldOff, Music2 } from "lucide-react";
import { TimerCircle } from "@/components/timer/TimerCircle";
import { TimerControls } from "@/components/timer/TimerControls";

// Страница остаётся Server Component (никакого "use client" на верхнем
// уровне) — интерактивность инкапсулирована в TimerCircle/TimerControls,
// которые сами по себе Client Components. Это даёт быстрый первый рендер
// текста лендинга без лишнего JS, при этом сам таймер полностью рабочий
// сразу, без регистрации: гость видит его первым, а не обещание в тексте.
export default function LandingPage() {
  return (
    <>
      <section className="container flex flex-col items-center gap-6 py-16 text-center">
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Помодоро-таймер для тех, кто ценит фокус
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Меньше отвлечений. Больше сделанного.
        </h1>

        <div className="flex flex-col items-center gap-8 py-6">
          <TimerCircle />
          <TimerControls />
        </div>

        <p className="max-w-xl text-lg text-muted-foreground">
          Flowora — минималистичный таймер техники Помодоро с историей прогресса,
          задачами и блокировкой отвлекающих сайтов. Работает прямо сейчас, без регистрации.
        </p>
        <Link
          href="/timer"
          className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Открыть полную версию таймера
        </Link>
        <p className="text-xs text-muted-foreground">
          Полностью бесплатно. Зарегистрируйтесь, чтобы сохранить историю и задачи.
        </p>
      </section>

      <section className="border-y border-border/60 bg-muted/30 py-20">
        <div className="container grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<Timer className="h-5 w-5" />}
            title="Классический таймер 25/5"
            description="Гибкая настройка длительности фокуса и перерывов под ваш ритм работы."
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5" />}
            title="История и аналитика"
            description="Графики фокуса по дням, heatmap-календарь и разбивка по проектам — бесплатно после регистрации."
          />
          <Feature
            icon={<ShieldOff className="h-5 w-5" />}
            title="Блокировка отвлечений"
            description="Расширение для Chrome автоматически блокирует соцсети во время фокус-сессии."
          />
          <Feature
            icon={<Music2 className="h-5 w-5" />}
            title="Звуки для концентрации"
            description="Библиотека лоу-фай и звуков природы, которые включаются на время сессии."
          />
        </div>
      </section>

      <section className="container py-24 text-center">
        <h2 className="text-2xl font-semibold">Начните за 10 секунд</h2>
        <ul className="mx-auto mt-6 flex max-w-md flex-col gap-3 text-left text-sm text-muted-foreground">
          <ListItem>Таймер уже работает выше — без регистрации и без карты</ListItem>
          <ListItem>Работайте 25 минут, отдыхайте 5</ListItem>
          <ListItem>Зарегистрируйтесь, когда захотите сохранить историю</ListItem>
        </ul>
        <Link
          href="/timer"
          className="mt-8 inline-block rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Перейти к таймеру
        </Link>
      </section>
    </>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
