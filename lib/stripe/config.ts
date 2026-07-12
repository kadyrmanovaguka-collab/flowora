// Единая точка правды о тарифах: и checkout route, и pricing-страница,
// и paywall-модалка берут названия/цены/лимиты из этого файла, а не
// хардкодят их в нескольких местах.

export type PlanId = "monthly" | "yearly";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceId: string; // Stripe Price ID из .env
  amount: number; // в валюте, для отображения (не для расчётов оплаты — сумму считает Stripe)
  currency: string;
  interval: "month" | "year";
  badge?: string;
}

// priceId читаем из process.env лениво (в функции, а не на верхнем уровне
// модуля), чтобы файл можно было безопасно импортировать и на клиенте
// (для отображения цены) без падения из-за отсутствия серверных переменных
// в browser-бандле — хотя сами Price ID не секретны, это просто гигиена.
export function getPlans(): PlanConfig[] {
  return [
    {
      id: "monthly",
      name: "Premium — месяц",
      priceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
      amount: 4.99,
      currency: "usd",
      interval: "month",
    },
    {
      id: "yearly",
      name: "Premium — год",
      priceId: process.env.STRIPE_PRICE_ID_YEARLY ?? "",
      amount: 39.99,
      currency: "usd",
      interval: "year",
      badge: "Экономия 33%",
    },
  ];
}

export function getPlanById(id: PlanId): PlanConfig {
  const plan = getPlans().find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}

// Лимиты free-плана — используются и в UI (чтобы показать "3 из 3 пресетов
// использовано"), и на сервере (чтобы ЗАБЛОКИРОВАТЬ создание 4-го пресета
// даже если пользователь обойдёт проверку на клиенте через devtools).
export const FREE_PLAN_LIMITS = {
  timerPresets: 1, // только дефолтный пресет 25/5, без сохранения новых
  soundLibraryTracks: 4, // встроенные звуки без доступа к полной библиотеке
  historyDays: 0, // без истории — только "сегодня"
} as const;

// Триггеры показа paywall-модалки — вынесены сюда, чтобы поведение продукта
// (когда именно "давить" на конверсию) было в одном месте, а не размазано
// по компонентам.
export const PAYWALL_TRIGGERS = {
  minSessionsCompleted: 10,
  minConsecutiveDays: 3,
} as const;
