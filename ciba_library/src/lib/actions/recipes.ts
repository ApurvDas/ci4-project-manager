"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { recipeInputSchema, type RecipeInput } from "@/lib/validation";
import { hueFromString } from "@/lib/placeholder";

/*
 * Recipe create/update server actions. Both validate against the same zod
 * schema the form uses, enforce authorship server-side, and return the saved
 * slug so the client can navigate to the recipe.
 */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Append -2, -3, … until the slug is free (ignoring the recipe being edited). */
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = base || "recipe";
  let slug = root;
  let n = 1;
  while (true) {
    const existing = await prisma.recipe.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === ignoreId) return slug;
    n += 1;
    slug = `${root}-${n}`;
  }
}

function nestedWrites(input: RecipeInput) {
  return {
    ingredients: {
      create: input.ingredients.map((ing, i) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit ? ing.unit : null,
        notes: ing.notes ? ing.notes : null,
        order: i,
      })),
    },
    steps: {
      create: input.steps.map((s, i) => ({
        stepNumber: i + 1,
        instruction: s.instruction,
      })),
    },
    tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
  };
}

export async function createRecipe(
  input: RecipeInput,
): Promise<{ slug: string }> {
  const userId = await requireUserId();
  const data = recipeInputSchema.parse(input);

  const slug = await uniqueSlug(slugify(data.title));
  await prisma.recipe.create({
    data: {
      slug,
      title: data.title,
      description: data.description,
      authorId: userId,
      categoryId: data.categoryId,
      servings: data.servings,
      prepTimeMins: data.prepTimeMins,
      cookTimeMins: data.cookTimeMins,
      difficulty: data.difficulty,
      imageUrl: data.imageUrl ? data.imageUrl : null,
      imageHue: hueFromString(slug),
      ...nestedWrites(data),
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/dashboard/recipes");
  revalidatePath("/");
  return { slug };
}

export async function updateRecipe(
  slug: string,
  input: RecipeInput,
): Promise<{ slug: string }> {
  const userId = await requireUserId();
  const data = recipeInputSchema.parse(input);

  const existing = await prisma.recipe.findUnique({
    where: { slug },
    select: { id: true, authorId: true },
  });
  if (!existing || existing.authorId !== userId) {
    throw new Error("Recipe not found.");
  }

  // Replace child rows wholesale — simplest correct way to reconcile edits.
  await prisma.$transaction([
    prisma.ingredient.deleteMany({ where: { recipeId: existing.id } }),
    prisma.step.deleteMany({ where: { recipeId: existing.id } }),
    prisma.recipeTag.deleteMany({ where: { recipeId: existing.id } }),
    prisma.recipe.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        servings: data.servings,
        prepTimeMins: data.prepTimeMins,
        cookTimeMins: data.cookTimeMins,
        difficulty: data.difficulty,
        imageUrl: data.imageUrl ? data.imageUrl : null,
        ...nestedWrites(data),
      },
    }),
  ]);

  revalidatePath(`/recipes/${slug}`);
  revalidatePath("/dashboard/recipes");
  return { slug };
}

export async function deleteRecipe(id: string): Promise<void> {
  const userId = await requireUserId();
  // Scoping the delete by authorId enforces ownership; cascades remove children.
  await prisma.recipe.deleteMany({ where: { id, authorId: userId } });

  revalidatePath("/recipes");
  revalidatePath("/dashboard/recipes");
  revalidatePath("/");
}
