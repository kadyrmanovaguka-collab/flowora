"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // refresh() пере-запрашивает Server Components (в т.ч. layout, который
    // читает user на сервере) — без этого шапка продолжила бы показывать
    // старое состояние "залогинен" до следующей навигации.
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className={className ?? "text-muted-foreground hover:text-foreground"}>
      Выйти
    </button>
  );
}
