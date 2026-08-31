import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/data/recipes";
import { getCategories, getTags } from "@/data/taxonomy";
import { getCurrentUser } from "@/data/users";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { updateRecipe } from "@/lib/actions/recipes";
import type { RecipeInput } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit recipe" };

interface EditPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditRecipePage({ params }: EditPageProps) {
  const { slug } = await params;
  const [recipe, categories, tags, currentUser] = await Promise.all([
    getRecipeBySlug(slug),
    getCategories(),
    getTags(),
    getCurrentUser(),
  ]);

  if (!recipe) notFound();
  // Only the author may edit. (Enforced again server-side in Phase 4.)
  if (!currentUser || currentUser.id !== recipe.author.id) notFound();

  const defaults: Partial<RecipeInput> = {
    title: recipe.title,
    description: recipe.description,
    categoryId: recipe.category.id,
    servings: recipe.servings,
    prepTimeMins: recipe.prepTimeMins,
    cookTimeMins: recipe.cookTimeMins,
    difficulty: recipe.difficulty,
    imageUrl: recipe.imageUrl ?? "",
    tagIds: recipe.tags.map((t) => t.id),
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ?? "",
      notes: i.notes ?? "",
    })),
    steps: recipe.steps.map((s) => ({ instruction: s.instruction })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Edit recipe</h1>
        <p className="text-muted-foreground">
          Update “{recipe.title}” and save your changes.
        </p>
      </header>
      <RecipeForm
        categories={categories}
        tags={tags}
        defaultValues={defaults}
        mode="edit"
        onSubmit={updateRecipe.bind(null, recipe.slug)}
      />
    </div>
  );
}
