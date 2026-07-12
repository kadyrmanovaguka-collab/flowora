import { NextResponse } from "next/server";
import { createTokenClient, extractBearerToken } from "@/lib/supabase/token-client";

// GET /api/extension/lists
// Возвращает актуальные blacklist/whitelist пользователя. Расширение вызывает
// это при старте и периодически (раз в несколько минут), чтобы подхватывать
// изменения списков, сделанные на сайте, без необходимости переустанавливать
// или вручную обновлять расширение.
export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Отсутствует токен авторизации" }, { status: 401 });
  }

  const supabase = createTokenClient(token);

  const { data, error } = await supabase
    .from("blocked_domains")
    .select("domain, list_type")
    .returns<{ domain: string; list_type: "blacklist" | "whitelist" }[]>();

  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить списки" }, { status: 401 });
  }

  const blacklist = (data ?? []).filter((row) => row.list_type === "blacklist").map((row) => row.domain);
  const whitelist = (data ?? []).filter((row) => row.list_type === "whitelist").map((row) => row.domain);

  return NextResponse.json({ blacklist, whitelist });
}
