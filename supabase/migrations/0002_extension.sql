-- =============================================================================
-- FLOWORA — миграция 0002: Website Blocker (Chrome-расширение)
-- =============================================================================
-- Добавляет две таблицы, необходимые для работы расширения-блокировщика:
--
-- 1. blocked_domains — пользовательские black/white списки доменов,
--    редактируются на сайте (Premium) и читаются расширением.
-- 2. active_focus_sessions — "живой" маркер того, что ПРЯМО СЕЙЧАС у
--    пользователя идёт фокус-сессия на сайте. Это НЕ история (она в
--    таблице sessions), а эфемерное состояние: одна строка на пользователя,
--    которая создаётся при старте фокуса и удаляется при его окончании/паузе.
--    Расширению нужно именно это — знать "включать ли блокировку прямо
--    сейчас", а не разбирать историю завершённых сессий.
-- =============================================================================


-- =============================================================================
-- ТАБЛИЦА: blocked_domains
-- =============================================================================
create table public.blocked_domains (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Храним домен без протокола и www (например "instagram.com"), нормализация
  -- происходит на клиенте перед вставкой — так сравнение в расширении через
  -- declarativeNetRequest урлFilter остаётся простым и предсказуемым.
  domain text not null check (domain = lower(domain)),
  list_type text not null check (list_type in ('blacklist', 'whitelist')),

  created_at timestamptz not null default now(),

  -- Один и тот же домен не может быть одновременно дважды в одном списке —
  -- но МОЖЕТ быть одновременно в blacklist и whitelist (обрабатывается в
  -- расширении по правилу "whitelist приоритетнее"), поэтому unique
  -- constraint включает list_type, а не только domain.
  unique (user_id, domain, list_type)
);

alter table public.blocked_domains enable row level security;

create policy "blocked_domains_select_own"
  on public.blocked_domains for select
  using (auth.uid() = user_id);

create policy "blocked_domains_insert_own"
  on public.blocked_domains for insert
  with check (auth.uid() = user_id);

create policy "blocked_domains_delete_own"
  on public.blocked_domains for delete
  using (auth.uid() = user_id);

-- Индекс под запрос расширения "все домены пользователя" — расширение
-- запрашивает оба списка одним select, фильтруя по user_id (через RLS
-- auth.uid() запрос неявно уже ограничен, индекс просто ускоряет сам scan).
create index blocked_domains_user_idx on public.blocked_domains(user_id);


-- =============================================================================
-- ТАБЛИЦА: active_focus_sessions
-- =============================================================================
create table public.active_focus_sessions (
  -- PRIMARY KEY = user_id (а не отдельный uuid) — у пользователя физически
  -- не может идти два фокус-таймера одновременно, поэтому "upsert по
  -- user_id" — самая естественная операция и на клиенте, и здесь.
  user_id uuid primary key references auth.users(id) on delete cascade,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.active_focus_sessions enable row level security;

-- SELECT нужен САМОМУ пользователю (через расширение, с его access token) —
-- расширение подставляет тот же JWT, что и залогиненный на сайте юзер,
-- поэтому auth.uid() внутри политики отработает как обычно.
create policy "active_focus_sessions_select_own"
  on public.active_focus_sessions for select
  using (auth.uid() = user_id);

create policy "active_focus_sessions_upsert_own"
  on public.active_focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "active_focus_sessions_update_own"
  on public.active_focus_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "active_focus_sessions_delete_own"
  on public.active_focus_sessions for delete
  using (auth.uid() = user_id);
