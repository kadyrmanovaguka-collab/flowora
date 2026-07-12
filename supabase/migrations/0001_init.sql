-- =============================================================================
-- FLOWORA — начальная миграция базы данных
-- =============================================================================
-- Применение:
--   supabase db push
-- или вручную через Supabase Dashboard → SQL Editor → вставить и выполнить.
--
-- ОБЩИЙ ПРИНЦИП БЕЗОПАСНОСТИ ЭТОЙ МИГРАЦИИ:
-- Row Level Security (RLS) включён на КАЖДОЙ таблице с пользовательскими
-- данными. Supabase по умолчанию даёт роли "anon"/"authenticated" доступ
-- через PostgREST напрямую из браузера, поэтому если не включить RLS —
-- любой пользователь сможет читать/писать чужие строки, просто зная URL
-- проекта и anon-ключ (который и так публичный). RLS — это единственная
-- реальная граница доступа в этой архитектуре.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- РАСШИРЕНИЯ
-- -----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";


-- -----------------------------------------------------------------------------
-- ФУНКЦИЯ: автообновление updated_at
-- -----------------------------------------------------------------------------
-- Используется триггерами BEFORE UPDATE на нескольких таблицах, чтобы не
-- дублировать "updated_at = now()" в каждом UPDATE-запросе из кода — это
-- легко забыть в одном из мест и получить рассинхронизацию.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- =============================================================================
-- ТАБЛИЦА: profiles
-- =============================================================================
-- Одна строка на пользователя. Создаётся автоматически триггером при
-- регистрации (см. handle_new_user ниже) — благодаря этому в коде фронтенда
-- никогда не нужно писать "insert into profiles" вручную и нет риска
-- забыть это сделать после OAuth-логина через Google.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),

  -- Локальные данные из localStorage (гостевой режим) мигрируют один раз
  -- при первом входе. Этот флаг не даёт миграции запуститься повторно,
  -- если пользователь зайдёт с нового устройства, где в localStorage
  -- случайно оказались какие-то старые демо-данные.
  guest_data_migrated boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SELECT: пользователь видит только свой профиль.
-- Без этого любой authenticated пользователь мог бы прочитать email и имя
-- всех остальных пользователей сервиса через прямой запрос к PostgREST.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- UPDATE: пользователь может менять только свои поля (например тему).
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Намеренно НЕТ policy на INSERT/DELETE для authenticated: строка профиля
-- создаётся только триггером handle_new_user (см. ниже), который выполняется
-- с правами definer'а и обходит RLS. Пользователь не должен иметь возможность
-- создать себе профиль с произвольным id, подставив чужой uuid.

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- ТРИГГЕР: автосоздание профиля и подписки при регистрации
-- -----------------------------------------------------------------------------
-- security definer — функция выполняется с правами создателя (постгрес-роль
-- supabase_admin), а не вызывающего пользователя. Это необходимо, потому что
-- в момент срабатывания триггера auth.uid() ещё не обязательно совпадает
-- с новой строкой так, чтобы обычные RLS-policy пропустили INSERT.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Каждый новый пользователь стартует на плане free — явное создание строки
  -- (а не NULL/отсутствие строки) упрощает все запросы на клиенте: не нужно
  -- обрабатывать случай "подписки вообще нет", всегда есть ровно одна строка.
  insert into public.subscriptions (user_id, status, plan)
  values (new.id, 'free', 'free');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- ТАБЛИЦА: subscriptions
-- =============================================================================
-- Хранит ТОЛЬКО метаданные подписки, необходимые для управления доступом.
-- Намеренно НЕ хранятся: номер карты, CVV, платёжный адрес — это зона
-- ответственности Stripe (PCI DSS compliance), а не нашей базы.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,

  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  status text not null default 'free'
    check (status in ('free', 'active', 'trialing', 'past_due', 'canceled', 'lifetime')),
  plan text not null default 'free'
    check (plan in ('free', 'monthly', 'yearly', 'lifetime')),

  current_period_end timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- SELECT: пользователь может проверить статус СВОЕЙ подписки (это нужно
-- клиенту, чтобы решить, показывать premium-функции или нет, и чтобы
-- подписаться на Realtime-изменения этой строки).
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- КРИТИЧНО ДЛЯ БЕЗОПАСНОСТИ:
-- Нет policy на INSERT/UPDATE/DELETE для роли authenticated.
-- Это значит, что обычный залогиненный пользователь НЕ МОЖЕТ отправить
-- запрос "UPDATE subscriptions SET status = 'active' WHERE user_id = ..."
-- через клиентский Supabase SDK и выдать себе premium бесплатно.
-- Единственный способ изменить статус — через service_role ключ, который
-- используется только в app/api/stripe/webhook/route.ts после проверки
-- подлинности подписи запроса от Stripe. service_role игнорирует RLS
-- полностью, поэтому мы не создаём для него отдельную policy — он и так
-- имеет полный доступ на уровне роли Postgres, а не на уровне policy.

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();


-- =============================================================================
-- ТАБЛИЦА: projects
-- =============================================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  color text not null default '#8b5cf6', -- hex-цвет для pie chart и меток задач
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Единый паттерн для всех "личных" таблиц (projects/tasks/sessions/...):
-- USING проверяет видимость существующих строк (SELECT/UPDATE/DELETE),
-- WITH CHECK проверяет данные НОВОЙ/изменённой строки (INSERT/UPDATE) —
-- без WITH CHECK пользователь мог бы, например, вставить задачу с чужим
-- user_id, просто подставив его в теле INSERT-запроса.
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


-- =============================================================================
-- ТАБЛИЦА: tasks
-- =============================================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  name text not null check (char_length(name) between 1 and 200),
  estimated_pomodoros smallint not null default 1 check (estimated_pomodoros > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_own"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own"
  on public.tasks for delete
  using (auth.uid() = user_id);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Индекс ускоряет частый запрос "все задачи проекта X у пользователя Y"
-- на странице /tasks с фильтром по проекту.
create index tasks_project_id_idx on public.tasks(project_id);


-- =============================================================================
-- ТАБЛИЦА: sessions (история помодоро-сессий)
-- =============================================================================
create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,

  type text not null check (type in ('focus', 'short_break', 'long_break')),
  planned_duration_seconds integer not null check (planned_duration_seconds > 0),
  actual_duration_seconds integer not null check (actual_duration_seconds >= 0),

  -- completed = false означает, что сессия была прервана до конца (например
  -- пользователь закрыл вкладку) — отделяем от завершённых для честной
  -- статистики "сколько ПОЛНЫХ помодоро сделано сегодня"
  completed boolean not null default false,

  started_at timestamptz not null,
  ended_at timestamptz,

  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "sessions_select_own"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Намеренно НЕТ policy на DELETE: история сессий — это источник правды для
-- streaks/achievements/аналитики, пользователю не даём удалять отдельные
-- записи из клиента, чтобы не могли задним числом накрутить/скрыть статистику
-- (например удалить прерванные сессии, чтобы улучшить процент завершения).

-- Индекс под самый частый запрос дашборда: "мои сессии за период, отсортированные
-- по дате" — без него на большом объёме данных график будет собираться медленно.
create index sessions_user_started_idx on public.sessions(user_id, started_at desc);
create index sessions_task_id_idx on public.sessions(task_id);


-- =============================================================================
-- ТАБЛИЦА: timer_presets (premium: именованные пресеты длительностей)
-- =============================================================================
create table public.timer_presets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null check (char_length(name) between 1 and 50),
  focus_minutes smallint not null check (focus_minutes between 1 and 180),
  short_break_minutes smallint not null check (short_break_minutes between 1 and 60),
  long_break_minutes smallint not null check (long_break_minutes between 1 and 90),
  sessions_before_long_break smallint not null default 4 check (sessions_before_long_break between 1 and 12),

  created_at timestamptz not null default now()
);

alter table public.timer_presets enable row level security;

create policy "timer_presets_select_own"
  on public.timer_presets for select
  using (auth.uid() = user_id);

create policy "timer_presets_insert_own"
  on public.timer_presets for insert
  with check (auth.uid() = user_id);

create policy "timer_presets_update_own"
  on public.timer_presets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "timer_presets_delete_own"
  on public.timer_presets for delete
  using (auth.uid() = user_id);

-- Ограничение "не больше N пресетов на free-плане" НЕ реализуется через SQL
-- constraint, а проверяется в API route перед INSERT — потому что "N" зависит
-- от подписки пользователя (таблица subscriptions), а business-правила такого
-- рода читаемее и легче меняются в коде приложения, чем в SQL triggers.


-- =============================================================================
-- ТАБЛИЦА: achievements
-- =============================================================================
create table public.achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Ключ бейджа, например 'streak_7', 'streak_30', 'sessions_100'.
  -- Уникальный индекс (user_id, achievement_key) не даёт разблокировать
  -- один и тот же бейдж дважды при повторном срабатывании фоновой проверки.
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),

  unique (user_id, achievement_key)
);

alter table public.achievements enable row level security;

create policy "achievements_select_own"
  on public.achievements for select
  using (auth.uid() = user_id);

create policy "achievements_insert_own"
  on public.achievements for insert
  with check (auth.uid() = user_id);

-- Нет UPDATE/DELETE: разблокированный бейдж — это факт истории, его нельзя
-- редактировать или отозвать из клиента.


-- =============================================================================
-- REALTIME
-- =============================================================================
-- Включаем Realtime только для subscriptions — это единственная таблица,
-- за изменением которой клиенту нужно следить "живьём" (чтобы интерфейс
-- разблокировал premium сразу после оплаты, без перезагрузки страницы).
-- Остальные таблицы не добавляем в publication намеренно: лишние Realtime-
-- подписки увеличивают нагрузку и открывают дополнительную поверхность
-- для чтения данных, которая нам не нужна.
alter publication supabase_realtime add table public.subscriptions;
