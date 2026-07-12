import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Роуты, требующие авторизации. Таймер (/timer) намеренно НЕ входит в этот
// список — по ТЗ таймер должен работать сразу, без регистрации (гостевой
// режим через localStorage). Защищаем только те разделы, которые не имеют
// смысла без аккаунта: дашборд с историей и управление задачами/проектами.
const PROTECTED_PREFIXES = ["/dashboard", "/tasks", "/settings"];

export async function middleware(request: NextRequest) {
  // updateSession делает две вещи одним движением: обновляет access token
  // в cookies (см. комментарий в lib/supabase/middleware.ts) И возвращает
  // текущего пользователя — нам не нужно делать это дважды.
  const { response, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    // Сохраняем исходный путь, чтобы после логина вернуть пользователя
    // туда, куда он изначально шёл, а не на дефолтную страницу.
    redirectUrl.searchParams.set("redirect_to", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Матчер исключает статику и файлы изображений — прогонять middleware
  // (и тем более дёргать Supabase Auth) на каждый запрос картинки бессмысленно
  // и заметно замедлило бы навигацию.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
