"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Post a comment on a recipe as the current user. */
export async function postComment(
  recipeSlug: string,
  body: string,
): Promise<void> {
  const userId = await requireUserId();
  const text = body.trim();
  if (text.length === 0) throw new Error("Comment can't be empty.");
  if (text.length > 2000) throw new Error("Comment is too long.");

  const recipe = await prisma.recipe.findUnique({
    where: { slug: recipeSlug },
    select: { id: true },
  });
  if (!recipe) throw new Error("Recipe not found.");

  await prisma.comment.create({
    data: { recipeId: recipe.id, userId, body: text },
  });

  revalidatePath(`/recipes/${recipeSlug}`);
}
