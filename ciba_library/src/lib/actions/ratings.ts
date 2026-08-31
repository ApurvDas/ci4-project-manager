"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Upsert the current user's 1–5 rating for a recipe. */
export async function rateRecipe(
  recipeSlug: string,
  value: number,
): Promise<void> {
  const userId = await requireUserId();
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const recipe = await prisma.recipe.findUnique({
    where: { slug: recipeSlug },
    select: { id: true },
  });
  if (!recipe) throw new Error("Recipe not found.");

  await prisma.rating.upsert({
    where: { recipeId_userId: { recipeId: recipe.id, userId } },
    create: { recipeId: recipe.id, userId, value },
    update: { value },
  });

  revalidatePath(`/recipes/${recipeSlug}`);
}
