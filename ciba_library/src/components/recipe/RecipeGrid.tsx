import type { Recipe } from "@/lib/types";
import { RecipeCard } from "./RecipeCard";
import { cn } from "@/lib/utils";

interface RecipeGridProps {
  recipes: Recipe[];
  showAuthor?: boolean;
  className?: string;
}

/**
 * Static grid of recipe cards for server-rendered lists (home, profiles). The
 * filter page uses <FlipGrid> instead so re-layout animates.
 */
export function RecipeGrid({ recipes, showAuthor, className }: RecipeGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} showAuthor={showAuthor} />
      ))}
    </div>
  );
}
