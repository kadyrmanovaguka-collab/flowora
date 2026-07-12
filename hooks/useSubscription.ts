"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subscription } from "@/types/database";

interface UseSubscriptionResult {
  subscription: Subscription | null;
  isPremium: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "lifetime"]);

// Этот хук — сердце "мгновенной разблокировки" из ТЗ (п.8 общей логики):
// 1. При маунте читает текущий статус подписки из Supabase.
// 2. Подписывается на Realtime UPDATE этой ОДНОЙ строки (user_id = свой).
// 3. Когда webhook Stripe (см. app/api/stripe/webhook/route.ts) через
//    service_role обновляет status в базе — Postgres Realtime рассылает
//    событие всем подписанным клиентам, и это событие долетает сюда без
//    поллинга, без перезагрузки страницы и без повторного логина.
export function useSubscription(userId: string | null): UseSubscriptionResult {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    // RLS policy "subscriptions_select_own" гарантирует, что этот запрос
    // физически не может вернуть чужую строку, даже если бы в коде где-то
    // закралась ошибка с userId — база отфильтрует на своей стороне.
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error) {
      setSubscription(data);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSubscription();

    if (!userId) return;

    const supabase = createClient();

    // Канал фильтруется по user_id на уровне Postgres changes filter —
    // это не замена RLS (Realtime всё равно проверяет RLS перед отправкой
    // события конкретному клиенту), но снижает лишний трафик, отсекая
    // события по чужим строкам ещё до применения политик.
    const channel = supabase
      .channel(`subscription-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setSubscription(payload.new as Subscription);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSubscription]);

  const isPremium = subscription ? ACTIVE_STATUSES.has(subscription.status) : false;

  return { subscription, isPremium, isLoading, refetch: fetchSubscription };
}
