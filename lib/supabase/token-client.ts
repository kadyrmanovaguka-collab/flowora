import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Chrome-расширение — не браузерная вкладка нашего сайта, у него нет доступа
// к httpOnly cookies сессии Supabase Auth. Поэтому оно логинится один раз
// в popup, получает access_token и шлёт его в заголовке
// Authorization: Bearer <token> на наши API routes.
//
// Без generic-параметра <Database> — см. объяснение в lib/supabase/client.ts.
export function createTokenClient(accessToken: string) {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
    },
  });
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}