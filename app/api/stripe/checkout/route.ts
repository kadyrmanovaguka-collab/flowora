import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe/client";
import { getPlanById, type PlanId } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  planId: z.enum(["monthly", "yearly"]),
});

// POST /api/stripe/checkout
// Создаёт Stripe Checkout Session (hosted page) и возвращает URL для редиректа.
// Мы НИКОГДА не создаём собственную форму ввода карты — только это.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Оплата обязательно привязывается к залогиненному пользователю: webhook
  // должен знать, чей user_id обновлять в таблице subscriptions. Без этого
  // мы бы получили платёж, который физически некому засчитать.
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const parseResult = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parseResult.success) {
    return NextResponse.json({ error: "Некорректный planId" }, { status: 400 });
  }

  const plan = getPlanById(parseResult.data.planId as PlanId);
  if (!plan.priceId) {
    // Защита от неправильно настроенного .env (забыли создать Price в Stripe
    // Dashboard) — лучше явная ошибка 500 с понятным сообщением в логах,
    // чем непонятный сбой Stripe API с "No such price".
    return NextResponse.json({ error: "Тариф временно недоступен" }, { status: 500 });
  }

  // Получаем текущую подписку, чтобы переиспользовать существующего Stripe
  // Customer, если он уже был создан ранее (например при неудачной попытке
  // оплаты) — иначе у одного пользователя в Stripe копились бы дубликаты
  // customer-записей.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: subscription?.stripe_customer_id ?? undefined,
      customer_email: subscription?.stripe_customer_id ? undefined : user.email ?? undefined,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      // client_reference_id и metadata дублируют user.id намеренно: webhook
      // может получить subscription/checkout.session событие в разном порядке,
      // и полезно иметь user_id доступным на объекте subscription напрямую
      // (через metadata), а не только через customer → отдельный lookup.
      client_reference_id: user.id,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Без этого catch любая ошибка Stripe API (неверный ключ, неверный
    // priceId, аккаунт не завершил онбординг и т.д.) улетала бы как
    // необработанный 500 с HTML-страницей Next.js вместо JSON — клиентский
    // fetch().json() падал бы с невнятной ошибкой парсинга, а причина
    // (например "Invalid API Key") оставалась видна только в логах сервера.
    console.error("Stripe checkout error:", err);
    const message = err instanceof Error ? err.message : "Неизвестная ошибка Stripe";
    return NextResponse.json({ error: `Ошибка Stripe: ${message}` }, { status: 500 });
  }
}
