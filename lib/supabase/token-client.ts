import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Chrome-расширение — не браузерная вкладка нашего сайта, у него нет доступа
// к httpOnly cookies сессии Supabase Auth. Поэтому оно логинится один раз
// в popup (см. chrome-extension/popup/popup.js), получает access_token и
// шлёт его в заголовке Authorization: Bearer <token> на наши API routes.
//
// Этот клиент подставляет тот же токен в заголовки к PostgREST — благодаря
// этому auth.uid() внутри RLS-политик видит РЕАЛЬНОГО пользователя расширения,
// а не анонима, и все "_own" policies из миграций продолжают работать
// без каких-либо специальных исключений для расширения.
export function createTokenClient(accessToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        persistSession: false, // серверный контекст — нечего и некуда персистить
      },
    }
  );
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}
