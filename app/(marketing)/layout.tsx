import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// force-dynamic обязателен здесь: без него Next.js может отдать клиенту
// закэшированный на клиенте (Router Cache) рендер этого layout'а с того
// момента, когда пользователь ещё не был залогинен — и после входа шапка
// на страницах вроде /pricing продолжит показывать "Войти" до полной
// перезагрузки, хотя /timer уже покажет верный статус. force-dynamic
// гарантирует свежую проверку auth.getUser() при каждом заходе.
export const dynamic = "force-dynamic";

// Отдельная route group (marketing) от (app) намеренно: у лендинга своя
// шапка без ссылок на "Дашборд/Задачи" (они бессмысленны для незалогиненного
// гостя) и другой визуальный ритм — это чисто маркетинговая страница.
//
// async-layout: раньше здесь всегда рисовалась ссылка "Войти" независимо от
// того, залогинен человек или нет — баг, из-за которого залогиненный
// пользователь при клике попадал обратно на /login. Теперь шапка знает
// реальный статус авторизации (тот же паттерн, что и в (app)/layout.tsx).
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Flowora
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/timer" className="text-muted-foreground hover:text-foreground">
                  {user.email}
                </Link>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Войти
              </Link>
            )}
            <Link
              href="/timer"
              className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              {user ? "К таймеру" : "Начать бесплатно"}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Flowora. Сфокусируйся на важном.
      </footer>
    </div>
  );
}
