import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase после Google OAuth редиректит сюда с параметром ?code=...
// Обмен кода на сессию должен произойти на сервере (у него есть доступ к
// httpOnly cookies через lib/supabase/server.ts) — сделать это на клиенте
// напрямую нельзя.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect_to") ?? "/timer";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Полный редирект (а не router.push) намеренно: нужен свежий запрос,
  // чтобы middleware и Server Components увидели уже установленные cookies сессии.
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
