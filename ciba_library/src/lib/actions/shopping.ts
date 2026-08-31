"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

interface NewItem {
  name: string;
  quantity: number;
  unit: string | null;
}

/** Add ingredients to the current user's list, linked to their source recipe. */
export async function addToShoppingList(
  recipeSlug: string | null,
  items: NewItem[],
): Promise<void> {
  const userId = await requireUserId();
  if (items.length === 0) return;

  let recipeId: string | null = null;
  if (recipeSlug) {
    const recipe = await prisma.recipe.findUnique({
      where: { slug: recipeSlug },
      select: { id: true },
    });
    recipeId = recipe?.id ?? null;
  }

  await prisma.shoppingListItem.createMany({
    data: items.map((i) => ({
      userId,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ? i.unit : null,
      recipeId,
    })),
  });

  revalidatePath("/dashboard/shopping-list");
}

export async function toggleShoppingItem(
  id: string,
  checked: boolean,
): Promise<void> {
  const userId = await requireUserId();
  // Scoping by userId enforces ownership in a single query.
  await prisma.shoppingListItem.updateMany({
    where: { id, userId },
    data: { checked },
  });
  revalidatePath("/dashboard/shopping-list");
}

export async function removeShoppingItem(id: string): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingListItem.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard/shopping-list");
}

export async function clearCheckedItems(): Promise<void> {
  const userId = await requireUserId();
  await prisma.shoppingListItem.deleteMany({ where: { userId, checked: true } });
  revalidatePath("/dashboard/shopping-list");
}
