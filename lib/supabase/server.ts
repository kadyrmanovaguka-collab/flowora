import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Клиент для серверного контекста (Server Components, Route Handlers,
// Server Actions, middleware). Работает через cookies, а не через
// localStorage/заголовок Authorization — это то, что позволяет Supabase Auth
// понимать "кто вызывает" на сервере без дополнительной передачи токена
// с клиента вручную.
//
// ВАЖНО: этот клиент использует ANON-ключ и подчиняется RLS как обычный
// пользователь (auth.uid() берётся из его сессии). Он НЕ подходит для
// операций, которые должны обходить RLS — для этого есть отдельный
// createServiceRoleClient ниже.
//
// Без generic-параметра <Database> — см. подробное объяснение в
// lib/supabase/client.ts: вручную написанный тип базы не всегда точно
// совпадает по форме с ожиданиями конкретной версии @supabase/postgrest-js
// и провоцирует ложные ошибки типов только на строгой сборке.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        } catch {
          // setAll вызывается из Server Component, где нельзя писать cookies
          // (только из Server Action / Route Handler / middleware).
          // Ошибку можно безопасно игнорировать, если рядом есть middleware,
          // которое обновляет сессию на каждый запрос (см. middleware.ts) —
          // именно оно и является источником правды для refresh токена.
        }
      },
    },
  });
}

// Отдельный клиент с service_role ключом.
//
// !!! КРИТИЧНО ДЛЯ БЕЗОПАСНОСТИ !!!
// service_role полностью ИГНОРИРУЕТ RLS-политики — это административный
// доступ уровня базы данных. Импортировать этот файл можно ТОЛЬКО в коде,
// который гарантированно выполняется на сервере и никогда не попадёт в
// клиентский бандл.
//
// Никогда не:
//  - вызывать createServiceRoleClient() в "use client" компоненте
//  - передавать результат его запросов напрямую в ответ клиенту без фильтрации
//  - логировать SUPABASE_SERVICE_ROLE_KEY
export function createServiceRoleClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        /* no-op: сервисный клиент не читает и не пишет пользовательские cookies */
      },
    },
  });
}