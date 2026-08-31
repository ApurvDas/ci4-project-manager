import { Clock, Users, Flame } from "lucide-react";
import type { Difficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

interface RecipeMetaProps {
  prepTimeMins: number;
  cookTimeMins?: number;
  servings: number;
  difficulty?: Difficulty;
  className?: string;
}

export function RecipeMeta({
  prepTimeMins,
  cookTimeMins,
  servings,
  difficulty,
  className,
}: RecipeMetaProps) {
  const total = prepTimeMins + (cookTimeMins ?? 0);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Clock className="size-4" />
        {total} min
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users className="size-4" />
        {servings} servings
      </span>
      {difficulty && (
        <span className="inline-flex items-center gap-1.5">
          <Flame className="size-4" />
          {DIFFICULTY_LABEL[difficulty]}
        </span>
      )}
    </div>
  );
}
