import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Клиент для Client Components ("use client").
// Использует NEXT_PUBLIC_* переменные — они безопасны в браузере, потому что
// реальная защита данных обеспечивается RLS-политиками в базе, а не
// секретностью этого ключа (anon-ключ и так публичный по дизайну Supabase).
//
// Функция, а не синглтон-объект, потому что createBrowserClient должен
// вызываться на каждый рендер в контексте, где доступен document/cookies —
// создание один раз на уровне модуля иногда приводит к рассинхронизации
// сессии между вкладками.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
