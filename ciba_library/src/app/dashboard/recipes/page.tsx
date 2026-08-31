import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, BookMarked } from "lucide-react";
import { getCurrentUser } from "@/data/users";
import { getRecipesByAuthor } from "@/data/recipes";
import { deleteRecipe } from "@/lib/actions/recipes";
import { MyRecipesList } from "@/components/dashboard/MyRecipesList";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My recipes" };

export default async function MyRecipesPage() {
  const user = await getCurrentUser();
  const recipes = user ? await getRecipesByAuthor(user.username) : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My recipes</h1>
          <p className="text-muted-foreground">
            Everything you&apos;ve shared with the community.
          </p>
        </div>
        <Button asChild>
          <Link href="/recipes/new">
            <PlusCircle className="size-4" /> New recipe
          </Link>
        </Button>
      </header>

      {recipes.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="You haven't shared a recipe yet"
          description="Publish your first recipe and it'll show up here for you to manage."
          action={
            <Button asChild>
              <Link href="/recipes/new">Share a recipe</Link>
            </Button>
          }
        />
      ) : (
        <MyRecipesList recipes={recipes} onDelete={deleteRecipe} />
      )}
    </div>
  );
}
