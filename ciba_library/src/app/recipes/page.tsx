import type { Metadata } from "next";
import { UtensilsCrossed } from "lucide-react";
import { getRecipes } from "@/data/recipes";
import { getCategories, getGroupedTags } from "@/data/taxonomy";
import { parseFilters } from "@/lib/search";
import { FilterPanel } from "@/components/recipe/FilterPanel";
import { SortSelect } from "@/components/recipe/SortSelect";
import { FlipGrid } from "@/components/recipe/FlipGrid";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Pagination } from "@/components/recipe/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Browse recipes",
  description: "Filter the Ciba Library by category, diet, cuisine, and prep time.",
};

// Reads live recipe data per request; don't prerender at build.
export const dynamic = "force-dynamic";

interface RecipesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const filters = parseFilters(await searchParams);
  const [{ recipes, total, page, pageCount }, categories, groupedTags] =
    await Promise.all([
      getRecipes(filters),
      getCategories(),
      getGroupedTags(),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-medium tracking-tight">
          Recipes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse the community library and filter to exactly what you feel like
          cooking.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FilterPanel categories={categories} groupedTags={groupedTags} />
        </aside>

        <div>
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? "recipe" : "recipes"}
            </p>
            <SortSelect />
          </div>

          {recipes.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No recipes match those filters"
              description="Try removing a filter or widening your search to see more."
            />
          ) : (
            <FlipGrid itemKeys={recipes.map((r) => r.id)}>
              {recipes.map((recipe) => (
                <div key={recipe.id} data-flip-key={recipe.id}>
                  <RecipeCard recipe={recipe} showAuthor />
                </div>
              ))}
            </FlipGrid>
          )}

          <Pagination page={page} pageCount={pageCount} />
        </div>
      </div>
    </div>
  );
}
