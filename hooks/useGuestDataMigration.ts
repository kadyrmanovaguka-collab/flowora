"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { migrateGuestDataIfNeeded } from "@/lib/migrateGuestData";

// Для входа по email/паролю миграция уже вызывается прямо в app/login/page.tsx
// сразу после успешного signIn/signUp. Но для Google OAuth пользователь
// попадает на сайт заново через серверный /auth/callback, где нет доступа
// к localStorage — поэтому здесь мы подстраховываемся и довыполняем
// миграцию на клиенте при первом же открытии страницы таймера залогиненным
// пользователем. migrateGuestDataIfNeeded идемпотентна (проверяет
// profiles.guest_data_migrated), так что повторный вызов безопасен.
export function useGuestDataMigration() {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) migrateGuestDataIfNeeded(data.user.id);
    });
  }, []);
}
