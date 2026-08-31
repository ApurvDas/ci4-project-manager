import type { Metadata } from "next";
import { getCategories, getTags } from "@/data/taxonomy";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { createRecipe } from "@/lib/actions/recipes";

export const metadata: Metadata = { title: "Share a recipe" };
export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Share a recipe
        </h1>
        <p className="text-muted-foreground">
          Add your dish to the library. You can edit it anytime.
        </p>
      </header>
      <RecipeForm
        categories={categories}
        tags={tags}
        mode="create"
        onSubmit={createRecipe}
      />
    </div>
  );
}
