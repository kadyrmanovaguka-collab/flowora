// Типы соответствуют таблицам из supabase/migrations/0001_init.sql.
// В реальном проекте их лучше генерировать автоматически командой
//   supabase gen types typescript --project-id <id> > types/database.ts
// Здесь они выписаны вручную, чтобы миграция и типы были видны рядом
// и было понятно соответствие полей.

export type SubscriptionStatus =
  | "free"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "lifetime";

export type SubscriptionPlan = "free" | "monthly" | "yearly" | "lifetime";

export type SessionType = "focus" | "short_break" | "long_break";

export type Theme = "light" | "dark" | "system";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  theme: Theme;
  guest_data_migrated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  estimated_pomodoros: number;
  priority: "low" | "medium" | "high";
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  task_id: string | null;
  type: SessionType;
  planned_duration_seconds: number;
  actual_duration_seconds: number;
  completed: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TimerPreset {
  id: string;
  user_id: string;
  name: string;
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  sessions_before_long_break: number;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
}

export interface BlockedDomain {
  id: string;
  user_id: string;
  domain: string;
  list_type: "blacklist" | "whitelist";
  created_at: string;
}

export interface ActiveFocusSession {
  user_id: string;
  ends_at: string;
  updated_at: string;
}

// Форма Database-generic ниже намеренно повторяет структуру, которую
// реально ожидает @supabase/postgrest-js: каждая таблица должна иметь
// Row/Insert/Update/Relationships, а схема — Views/Functions/Enums/
// CompositeTypes (пусть и пустые). Без этих полей TypeScript в строгом
// режиме (`next build`/`tsc`, но НЕ `next dev`, который не гоняет полную
// проверку типов) может схлопнуть результат .select() в `never` —
// именно это ловилось только на сборке в Vercel, а не локально.
// В реальном проекте этот файл лучше генерировать командой
//   supabase gen types typescript --project-id <id> > types/database.ts
// вместо ручного описания — тогда такого расхождения не возникнет в принципе.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile>; Relationships: [] };
      subscriptions: {
        Row: Subscription;
        Insert: Partial<Subscription>;
        Update: Partial<Subscription>;
        Relationships: [];
      };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project>; Relationships: [] };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task>; Relationships: [] };
      sessions: { Row: Session; Insert: Partial<Session>; Update: Partial<Session>; Relationships: [] };
      timer_presets: {
        Row: TimerPreset;
        Insert: Partial<TimerPreset>;
        Update: Partial<TimerPreset>;
        Relationships: [];
      };
      achievements: { Row: Achievement; Insert: Partial<Achievement>; Update: Partial<Achievement>; Relationships: [] };
      blocked_domains: {
        Row: BlockedDomain;
        Insert: Partial<BlockedDomain>;
        Update: Partial<BlockedDomain>;
        Relationships: [];
      };
      active_focus_sessions: {
        Row: ActiveFocusSession;
        Insert: Partial<ActiveFocusSession>;
        Update: Partial<ActiveFocusSession>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
