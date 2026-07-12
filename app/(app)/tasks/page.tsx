import { createClient } from "@/lib/supabase/server";
import { createProject, createTask, deleteProject } from "./actions";
import { TaskRow } from "@/components/tasks/TaskRow";
import type { Project, Task } from "@/types/database";

// См. комментарий в app/(app)/dashboard/page.tsx — та же причина: страница
// с часто меняющимися пользовательскими данными не должна кэшироваться.
export const dynamic = "force-dynamic";

const PRESET_COLORS = ["#8b5cf6", "#10b981", "#0ea5e9", "#f59e0b", "#ef4444", "#ec4899"];

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;


  const [{ data: projects }, { data: tasks }, { data: sessionCounts }] = await Promise.all([
    supabase.from("projects").select("*").eq("archived", false).order("created_at").returns<Project[]>(),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).returns<Task[]>(),
    // Считаем, сколько ЗАВЕРШЁННЫХ focus-сессий приходится на каждую задачу —
    // группировку делаем в JS, а не в SQL, чтобы не усложнять миграцию
    // отдельной view ради одной страницы.
    supabase.from("sessions").select("task_id").eq("type", "focus").eq("completed", true),
  ]);

  const spentByTask = new Map<string, number>();
  for (const row of sessionCounts ?? []) {
    if (!row.task_id) continue;
    spentByTask.set(row.task_id, (spentByTask.get(row.task_id) ?? 0) + 1);
  }

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Проекты</h2>
        <ul className="flex flex-col gap-2">
          {(projects ?? []).map((project) => (
            <li key={project.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="flex-1 truncate">{project.name}</span>
              <form action={deleteProject.bind(null, project.id)}>
                <button className="text-xs text-muted-foreground hover:text-destructive">✕</button>
              </form>
            </li>
          ))}
          {(projects ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Пока нет проектов</p>
          )}
        </ul>

        <form action={createProject} className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <input
            name="name"
            placeholder="Новый проект"
            required
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((color) => (
              <label key={color}>
                <input type="radio" name="color" value={color} className="peer sr-only" defaultChecked={color === PRESET_COLORS[0]} />
                <span
                  className="block h-5 w-5 cursor-pointer rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-foreground"
                  style={{ backgroundColor: color }}
                />
              </label>
            ))}
          </div>
          <button type="submit" className="rounded-md bg-primary py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            Добавить проект
          </button>
        </form>
      </aside>

      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Задачи</h1>

        <form
          action={createTask}
          className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-border p-4 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <input
            name="name"
            placeholder="Название задачи"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select name="project_id" className="rounded-md border border-input bg-background px-2 py-2 text-sm">
            <option value="">Без проекта</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="estimated_pomodoros"
            min={1}
            defaultValue={1}
            className="w-20 rounded-md border border-input bg-background px-2 py-2 text-sm"
          />
          <select name="priority" defaultValue="medium" className="rounded-md border border-input bg-background px-2 py-2 text-sm">
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </select>
          <button
            type="submit"
            className="col-span-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:col-span-1"
          >
            Добавить
          </button>
        </form>

        <div className="flex flex-col gap-2">
          {(tasks ?? []).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectColor={task.project_id ? projectById.get(task.project_id)?.color : undefined}
              spentPomodoros={spentByTask.get(task.id) ?? 0}
            />
          ))}
          {(tasks ?? []).length === 0 && <p className="text-sm text-muted-foreground">Пока нет задач</p>}
        </div>
      </section>
    </div>
  );
}
