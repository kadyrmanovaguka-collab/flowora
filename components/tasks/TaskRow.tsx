"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleTaskCompleted, deleteTask } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

const PRIORITY_CLASS: Record<Task["priority"], string> = {
  low: "text-muted-foreground",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

// Импорт server action (toggleTaskCompleted/deleteTask) напрямую в клиентский
// компонент — Next.js превращает такой импорт в скрытый POST-запрос к серверу,
// не требуя ручного создания API route для каждого маленького действия.
export function TaskRow({
  task,
  projectColor,
  spentPomodoros,
}: {
  task: Task;
  projectColor?: string;
  spentPomodoros: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border p-3", isPending && "opacity-50")}>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={(e) => startTransition(() => toggleTaskCompleted(task.id, e.target.checked))}
        className="h-4 w-4 rounded accent-primary"
      />
      {projectColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: projectColor }} />}
      <div className="flex-1">
        <p className={cn("text-sm", task.completed && "text-muted-foreground line-through")}>{task.name}</p>
        <p className="text-xs text-muted-foreground">
          {spentPomodoros} / {task.estimated_pomodoros} помодоро ·{" "}
          <span className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</span>
        </p>
      </div>
      <button
        onClick={() => startTransition(() => deleteTask(task.id))}
        aria-label="Удалить задачу"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
