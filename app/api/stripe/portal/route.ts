import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

// POST /api/stripe/portal
// Управление подпиской (отмена, смена карты, история платежей) отдаётся
// целиком на откуп Stripe Customer Portal — мы не пишем свой UI для этого,
// что автоматически снимает с нас необходимость самим валидировать смену
// карты, обрабатывать proration и т.д.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    // Пользователь без Stripe Customer (никогда не платил) не может открыть
    // портал — там ему нечем управлять. Отправляем на pricing вместо ошибки.
    return NextResponse.json({ error: "Подписка не найдена" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
