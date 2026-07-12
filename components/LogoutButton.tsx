"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // router.refresh() заново прогоняет Server Components (в том числе
    // layout'ы, которые читают auth.getUser()) — без него шапка ещё
    // какое-то время показывала бы старое состояние "залогинен".
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className={className ?? "text-muted-foreground hover:text-foreground"}>
      Выйти
    </button>
  );
}
