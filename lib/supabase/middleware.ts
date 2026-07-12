import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Вынесено в отдельный файл, потому что этот код используется ИСКЛЮЧИТЕЛЬНО
// из middleware.ts, и логика там немного отличается от server.ts:
// middleware работает с NextRequest/NextResponse, а не с next/headers cookies().
//
// Зачем это вообще нужно: access token Supabase живёт недолго (по умолчанию
// 1 час). Если не обновлять его на каждый запрос, пользователь будет
// разлогиниваться каждый час несмотря на то, что refresh token валиден.
// Этот хелпер вызывается в middleware.ts на каждый запрос к /app/* и
// прозрачно продлевает сессию, записывая обновлённые cookies в response.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (а не getSession()) намеренно: getUser() делает реальный запрос
  // к Supabase Auth серверу и проверяет токен, а не просто читает то, что
  // лежит в cookie. Это важно на защищённых роутах — иначе можно было бы
  // подделать cookie с "валидной на вид" сессией без реальной проверки.
  const { data: { user } } = await supabase.auth.getUser();

  return { response, user };
}
