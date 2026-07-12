import { NextResponse } from "next/server";
import { createTokenClient, extractBearerToken } from "@/lib/supabase/token-client";

// GET /api/sessions/active
// Опрашивается расширением (background.js, chrome.alarms каждые ~20 секунд)
// ИЛИ обновляется мгновенно через сообщение от content script на сайте —
// опрос здесь служит подстраховкой на случай, если вкладка с сайтом закрыта,
// но пользователь всё равно хочет, чтобы блокировка отражала реальный статус.
export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Отсутствует токен авторизации" }, { status: 401 });
  }

  const supabase = createTokenClient(token);

  // RLS-политика active_focus_sessions_select_own гарантирует, что чужую
  // строку прочитать невозможно, даже если бы в этом коде была ошибка —
  // единственный источник user_id здесь — это auth.uid() из самого токена.
  const { data, error } = await supabase
    .from("active_focus_sessions")
    .select("ends_at")
    .maybeSingle<{ ends_at: string }>();

  if (error) {
    // Невалидный/просроченный токен обычно всплывает здесь как ошибка
    // PostgREST, а не как явный 401 — приводим к единому формату для расширения.
    return NextResponse.json({ error: "Не удалось проверить сессию" }, { status: 401 });
  }

  if (!data) {
    return NextResponse.json({ active: false, endsAt: null });
  }

  const endsAt = new Date(data.ends_at);
  const isStillActive = endsAt.getTime() > Date.now();

  return NextResponse.json({ active: isStillActive, endsAt: isStillActive ? data.ends_at : null });
}
