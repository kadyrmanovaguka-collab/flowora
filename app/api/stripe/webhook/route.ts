import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/database";

// Next.js по умолчанию парсит тело запроса как JSON, но Stripe требует
// ТОЧНЫЕ сырые байты тела для проверки подписи (constructEvent сверяет HMAC
// подписи именно с необработанной строкой). Поэтому ниже используется
// request.text(), а не request.json().

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "free";
  }
}

function mapPlanFromPriceId(priceId: string | undefined): SubscriptionPlan {
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "yearly";
  return "free";
}

// POST /api/stripe/webhook
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Отсутствует подпись" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // !!! КРИТИЧНО ДЛЯ БЕЗОПАСНОСТИ !!!
    // constructEvent проверяет HMAC-подпись запроса секретом STRIPE_WEBHOOK_SECRET.
    // Без этой проверки ЛЮБОЙ человек в интернете, узнав URL этого эндпоинта,
    // мог бы отправить сюда поддельный "customer.subscription.updated" с
    // status: "active" и бесплатно выдать себе Premium. Эта строка — граница
    // доверия между "кто угодно в интернете" и "реально Stripe".
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Неверная подпись" }, { status: 400 });
  }

  // service_role клиент — единственное место в приложении, где строки
  // subscriptions обновляются в обход RLS. Это осознанно: RLS специально
  // не даёт делать это через обычный authenticated-запрос (см. миграцию),
  // а сервер уже подтвердил подлинность события выше через подпись.
  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
        if (!userId || !session.customer) break;

        // На этом этапе подписка в Stripe уже создана, но у нас пока нет
        // деталей текущего периода — их подтянет следующее событие
        // customer.subscription.updated, которое Stripe шлёт практически
        // одновременно. Здесь достаточно сохранить customer_id, чтобы связать
        // аккаунт с Stripe даже если следующее событие почему-то задержится.
        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: session.customer as string })
          .eq("user_id", userId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        // Если metadata потерялась (например подписка была создана не через
        // наш checkout, а вручную в Dashboard), ищем пользователя по
        // customer_id, который мы сохранили на предыдущем шаге.
        const userIdToUpdate = userId ?? (await findUserIdByCustomerId(subscription.customer as string));
        if (!userIdToUpdate) {
          console.error("Webhook: не удалось определить user_id для подписки", subscription.id);
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;

        await supabase
          .from("subscriptions")
          .update({
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            status: mapStripeStatus(subscription.status),
            plan: mapPlanFromPriceId(priceId),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("user_id", userIdToUpdate);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId =
          subscription.metadata?.supabase_user_id ??
          (await findUserIdByCustomerId(subscription.customer as string));
        if (!userId) break;

        // Возвращаем на free, но НЕ удаляем stripe_customer_id/subscription_id —
        // они полезны как исторический след и позволяют Customer Portal
        // продолжать показывать историю платежей при повторной подписке.
        await supabase
          .from("subscriptions")
          .update({ status: "free", plan: "free" })
          .eq("user_id", userId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await findUserIdByCustomerId(invoice.customer as string);
        if (!userId) break;

        // past_due, а не сразу canceled — Stripe даёт пользователю несколько
        // попыток оплаты (Smart Retries) прежде чем подписка реально отменится;
        // мы не должны обрезать доступ раньше, чем это сделает сам Stripe.
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
        break;
      }

      default:
        // Остальные типы событий (их у Stripe несколько сотен) нам не нужны —
        // Stripe шлёт их независимо от того, подписаны мы на них в Dashboard
        // или нет, если endpoint настроен на "все события".
        break;
    }
  } catch (err) {
    console.error("Ошибка обработки Stripe webhook:", err);
    // Возвращаем 500, чтобы Stripe automatически повторил доставку события
    // позже (retry with exponential backoff) — если проблема была временной
    // (например Supabase был недоступен долю секунды), данные не потеряются.
    return NextResponse.json({ error: "Внутренняя ошибка обработки" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.user_id ?? null;
}
