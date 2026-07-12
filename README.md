# Flowora

Минималистичный Pomodoro-таймер. Полностью бесплатный — регистрация нужна
только чтобы было куда сохранять историю сессий, задачи и достижения.
Плюс Chrome-расширение для блокировки отвлекающих сайтов.

## Стек

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Realtime) · Zustand · Vercel

---

## 1. Локальный запуск

```bash
npm install
cp .env.local.example .env.local   # заполнить реальными значениями Supabase (см. раздел 2)
npm run dev
```

Приложение поднимется на http://localhost:3000. Таймер на `/timer` работает
сразу, без создания аккаунта — это гостевой режим на localStorage.

---

## 2. Настройка Supabase

### 2.1 Создание проекта
1. Зайдите на https://supabase.com/dashboard → **New project**.
2. Дождитесь провижининга (обычно 1-2 минуты).
3. Перейдите в **Project Settings → API** и скопируйте:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` / `Publishable key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `Secret key` → `SUPABASE_SERVICE_ROLE_KEY`

### 2.2 Применение миграций
Через **SQL Editor** в дашборде Supabase выполните по очереди содержимое файлов:
```
supabase/migrations/0001_init.sql
supabase/migrations/0002_extension.sql
```

Либо через Supabase CLI:
```bash
supabase link --project-ref <ваш-project-ref>
supabase db push
```

Миграция создаёт все таблицы, RLS-политики и триггеры (включая автосоздание
профиля при регистрации — см. комментарии в самих файлах миграций).

> Таблица `subscriptions` в схеме осталась от более ранней версии проекта
> (была задумана под платную подписку) — сейчас она просто не используется
> в коде приложения. Можно оставить как есть (не мешает) или удалить
> отдельной миграцией, если хочется идеальной чистоты схемы.

### 2.3 Включение Google OAuth (опционально)
**Authentication → Providers → Google** → включить, указать Client ID/Secret
из Google Cloud Console (создать OAuth Client с redirect URI вида
`https://<project-ref>.supabase.co/auth/v1/callback`).

---

## 3. Переменные окружения на Vercel

**Project Settings → Environment Variables** — добавьте все переменные из
`.env.local.example`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` = ваш реальный прод-домен
- `EXTENSION_API_SECRET` — если планируете дополнительно защищать API-роуты
  расширения собственной проверкой (базово авторизация идёт через Supabase
  JWT пользователя, см. `lib/supabase/token-client.ts`)

---

## 4. Деплой

```bash
npm install -g vercel   # если ещё не установлен
vercel                  # первый деплой, привяжет проект
vercel --prod           # прод-деплой
```

---

## 5. Chrome-расширение (Website Blocker)

1. Откройте `chrome-extension/manifest.json` и `chrome-extension/popup/popup.js`,
   замените `your-flowora-domain.vercel.app` и Supabase URL/anon-ключ на реальные
   значения вашего деплоя.
2. Добавьте иконки `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
   (см. `chrome-extension/icons/README.txt`).
3. Chrome → `chrome://extensions` → включите **Режим разработчика** →
   **Загрузить распакованное расширение** → выберите папку `chrome-extension/`.
4. Откройте popup расширения, войдите тем же email/паролем, что и на сайте.
5. На сайте добавьте домены в blacklist/whitelist через API `blocked_domains`
   (UI-страница управления списками ещё не построена отдельным экраном —
   пока можно вставлять строки напрямую через Supabase Table Editor или
   написать простую форму по аналогии с `/tasks`).
6. Запустите фокус-сессию на `/timer` под тем же аккаунтом — блокировка включится
   автоматически (мгновенно через content script, если вкладка с Flowora открыта,
   либо в течение ~20 секунд через фоновый опрос).

---

## 6. Реклама (заглушка)

Между фокус-сессией и перерывом (5-секундное окно автоперехода) показывается
полноэкранный рекламный слот — `components/ads/AdInterstitial.tsx`. Сейчас
там **плейсхолдер** (нет реального рекламного провайдера подключено). Чтобы
подключить настоящую рекламную сеть (например Google AdSense) — инструкция
прямо в комментариях этого файла: нужен опубликованный домен (не localhost) и
одобренный аккаунт в выбранной рекламной сети, это отдельный процесс за
рамками кода.

---

## 7. Библиотека звуков

`lib/soundLibrary.ts` содержит список из ~17 треков (лоу-фай/природа/эмбиент)
с путями вида `/sounds/lofi-1.mp3`. Сами аудиофайлы в проект **не включены**
(нужны royalty-free исходники) — положите реальные `.mp3` в `public/sounds/`
под именами из этого файла. Хорошие источники: Pixabay Music, Freesound.org
(проверяйте лицензию каждого трека), YouTube Audio Library.

---

## 8. Структура проекта

```
app/
  (marketing)/         — лендинг (публичная страница)
  (app)/                — /timer, /dashboard, /tasks, /settings (защищено middleware.ts)
  api/sessions/active/  — опрашивается расширением
  api/extension/lists/  — black/white списки для расширения
components/
  timer/                — TimerCircle (SVG + Framer Motion), TimerControls
  dashboard/            — графики, heatmap, экспорт, streaks
  tasks/                — CRUD-компоненты задач
  premium/              — библиотека звуков (название осталось от старой модели,
                           функция доступна всем зарегистрированным)
  ads/                  — рекламная заставка между сессиями
hooks/
  useActiveFocusSessionSync.ts  — синхронизация для Website Blocker
  usePersistSessionsForUser.ts  — выгрузка завершённых сессий в Supabase
lib/
  store/timerStore.ts   — вся логика таймера (Zustand + persist)
  supabase/             — клиенты для браузера/сервера/расширения
  achievements.ts        — подсчёт streak и разблокировка достижений
supabase/migrations/    — SQL-миграции с комментариями по каждой RLS-политике
chrome-extension/       — Manifest V3 расширение-блокировщик
```
