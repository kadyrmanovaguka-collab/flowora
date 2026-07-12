"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Все действия здесь полагаются на RLS ("_own" policies из миграции) как на
// единственную границу доступа: мы читаем user.id из сессии и передаём его
// в user_id вставляемых строк, а WITH CHECK на стороне базы физически не
// даст вставить/поменять строку с чужим user_id, даже если бы в этом коде
// была ошибка.

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Требуется авторизация");
  return { supabase, userId: user.id };
}

export async function createProject(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#8b5cf6");
  if (!name) return;

  await supabase.from("projects").insert({ user_id: userId, name, color });
  revalidatePath("/tasks");
}

export async function deleteProject(projectId: string) {
  const { supabase, userId } = await requireUserId();
  // .eq('user_id', userId) здесь избыточен относительно RLS, но оставлен
  // намеренно: явное условие в запросе делает код читаемым независимо от
  // того, что происходит в политике, и не полагается только на неё.
  await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
  revalidatePath("/tasks");
}

export async function createTask(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "") || null;
  const estimatedPomodoros = Number(formData.get("estimated_pomodoros") ?? 1);
  const priority = String(formData.get("priority") ?? "medium");

  if (!name) return;

  await supabase.from("tasks").insert({
    user_id: userId,
    project_id: projectId,
    name,
    estimated_pomodoros: estimatedPomodoros > 0 ? estimatedPomodoros : 1,
    priority,
  });
  revalidatePath("/tasks");
}

export async function toggleTaskCompleted(taskId: string, completed: boolean) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("tasks").update({ completed }).eq("id", taskId).eq("user_id", userId);
  revalidatePath("/tasks");
}

export async function deleteTask(taskId: string) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
  revalidatePath("/tasks");
}
