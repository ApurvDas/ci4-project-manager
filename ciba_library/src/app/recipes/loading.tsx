import { Skeleton } from "@/components/ui/skeleton";
import { RecipeGridSkeleton } from "@/components/recipe/RecipeCardSkeleton";

export default function RecipesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="mb-2 h-9 w-40" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-6 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </aside>
        <div>
          <Skeleton className="mb-6 h-5 w-24" />
          <RecipeGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
