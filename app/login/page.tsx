"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestDataIfNeeded } from "@/lib/migrateGuestData";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect_to") ?? "/timer";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Если человек уже залогинен (например перешёл на /login по старой
  // вкладке/ссылке), не показываем форму, а сразу отправляем дальше.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace(redirectTo);
      }
    });
  }, [redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        // Если в проекте включено подтверждение email (по умолчанию у
        // Supabase), сессии сразу не будет — просим проверить почту вместо
        // немедленного редиректа.
        if (!data.session) {
          setInfo("Мы отправили письмо для подтверждения на вашу почту.");
          return;
        }
        await migrateGuestDataIfNeeded(data.user!.id);
        router.push(redirectTo);
        router.refresh();
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Неверный email или пароль");
        return;
      }
      await migrateGuestDataIfNeeded(data.user.id);
      router.push(redirectTo);
      router.refresh(); // обновляет Server Components (например middleware/layout), которые уже проверили auth до логина
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    // redirect_to пробрасывается через query callback-роута, чтобы после
    // OAuth пользователь попал туда, откуда изначально шёл (см. app/auth/callback/route.ts)
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Flowora
        </Link>
        <h1 className="mt-4 text-lg font-medium">
          {mode === "signin" ? "Войти в аккаунт" : "Создать аккаунт"}
        </h1>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
      >
        Продолжить с Google
      </button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        или
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Подождите…" : mode === "signin" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-center text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
    </div>
  );
}

// useSearchParams требует границы Suspense в App Router — без неё Next.js
// падает с ошибкой сборки на страницах, которые читают query-параметры.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
