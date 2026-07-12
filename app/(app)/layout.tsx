import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// См. подробный комментарий в app/(marketing)/layout.tsx — та же причина:
// без этого шапка после логина/логаута может на пару навигаций отставать
// от реального состояния из-за клиентского Router Cache.
export const dynamic = "force-dynamic";

// Серверный layout: один раз получаем пользователя на сервере (без лишнего
// клиентского запроса при каждой навигации) и передаём его email в шапку.
// Сам layout остаётся Server Component — интерактивность (тема, меню)
// инкапсулирована в дочерних Client Components, чтобы не тянуть лишний JS
// в самый верхний уровень дерева.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/timer" className="text-lg font-semibold tracking-tight">
            Flowora
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/timer" className="hover:text-foreground">Таймер</Link>
            <Link href="/dashboard" className="hover:text-foreground">Дашборд</Link>
            <Link href="/tasks" className="hover:text-foreground">Задачи</Link>
            <Link href="/settings" className="hover:text-foreground">Настройки</Link>
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-xs">{user.email}</span>
                <LogoutButton className="text-xs hover:text-foreground" />
              </>
            ) : (
              <Link href="/login" className="font-medium text-primary hover:opacity-80">
                Войти
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
