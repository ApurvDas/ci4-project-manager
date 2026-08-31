"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Recipe } from "@/lib/types";
import { RecipeImage } from "@/components/recipe/RecipeImage";
import { StarRating } from "@/components/ratings/StarRating";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MyRecipesListProps {
  recipes: Recipe[];
  /** Wired to a delete server action in Phase 4. */
  onDelete?: (id: string) => Promise<void> | void;
}

/**
 * Manage list of the current user's recipes. Delete is a two-step inline
 * confirm (no blocking dialog) with optimistic removal; the real mutation is
 * passed in via onDelete in Phase 4.
 */
export function MyRecipesList({ recipes, onDelete }: MyRecipesListProps) {
  const [items, setItems] = React.useState(recipes);
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const remove = async (recipe: Recipe) => {
    const prev = items;
    setItems((list) => list.filter((r) => r.id !== recipe.id));
    setConfirming(null);
    try {
      await onDelete?.(recipe.id);
      toast.success(`Deleted “${recipe.title}”`);
    } catch {
      setItems(prev);
      toast.error("Couldn't delete that recipe.");
    }
  };

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((recipe) => (
        <li key={recipe.id} className="flex items-center gap-4 p-3">
          <Link
            href={`/recipes/${recipe.slug}`}
            className="size-16 shrink-0 overflow-hidden rounded-md"
          >
            <RecipeImage
              title={recipe.title}
              imageUrl={recipe.imageUrl}
              hue={recipe.imageHue}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/recipes/${recipe.slug}`}
              className="font-medium hover:text-primary"
            >
              {recipe.title}
            </Link>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <StarRating value={recipe.avgRating} readOnly size="sm" />
              <span>({recipe.ratingCount})</span>
              <span aria-hidden>·</span>
              <span>{recipe.commentCount} comments</span>
            </div>
          </div>

          {confirming === recipe.id ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Delete?
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => remove(recipe)}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cancel delete"
                onClick={() => setConfirming(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/recipes/${recipe.slug}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Pencil className="size-4" /> Edit
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${recipe.title}`}
                onClick={() => setConfirming(recipe.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
