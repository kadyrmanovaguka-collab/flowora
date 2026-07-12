import { Flame, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { cn } from "@/lib/utils";

export function StreakBadges({
  currentStreak,
  unlockedKeys,
}: {
  currentStreak: number;
  unlockedKeys: string[];
}) {
  const unlockedSet = new Set(unlockedKeys);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
          <Flame className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{currentStreak} {pluralizeDays(currentStreak)}</p>
          <p className="text-xs text-muted-foreground">текущий стрик подряд</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {ACHIEVEMENTS.map((achievement) => {
          const isUnlocked = unlockedSet.has(achievement.key);
          return (
            <div
              key={achievement.key}
              title={achievement.description}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                isUnlocked
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground/50"
              )}
            >
              {isUnlocked ? <Flame className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {achievement.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}
