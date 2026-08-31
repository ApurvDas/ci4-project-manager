import "server-only";
import type { Comment, Recipe, ShoppingListItem, UserSummary } from "@/lib/types";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  recipeInclude,
  toComment,
  toRecipe,
  toShoppingListItem,
  toUserSummary,
} from "./mappers";

/** The signed-in user derived from the auth session, or null when logged out. */
export async function getCurrentUser(): Promise<UserSummary | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toUserSummary(user) : null;
}

export async function getUserByUsername(
  username: string,
): Promise<UserSummary | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  return user ? toUserSummary(user) : null;
}

/** Does the current user follow the given user? */
export async function isFollowing(userId: string): Promise<boolean> {
  const session = await auth();
  const me = session?.user?.id;
  if (!me) return false;
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: me, followingId: userId } },
  });
  return follow !== null;
}

export async function getFollowerCount(userId: string): Promise<number> {
  return prisma.follow.count({ where: { followingId: userId } });
}

export async function getFollowingCount(userId: string): Promise<number> {
  return prisma.follow.count({ where: { followerId: userId } });
}

export async function getComments(recipeSlug: string): Promise<Comment[]> {
  const rows = await prisma.comment.findMany({
    where: { recipe: { slug: recipeSlug } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toComment);
}

export async function getShoppingList(): Promise<ShoppingListItem[]> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return [];
  const rows = await prisma.shoppingListItem.findMany({
    where: { userId: id },
    include: { recipe: { select: { slug: true, title: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map(toShoppingListItem);
}

/** Number of items on the current user's shopping list (0 when signed out). */
export async function getShoppingListCount(): Promise<number> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return 0;
  return prisma.shoppingListItem.count({ where: { userId: id } });
}

/** Recipes authored by users the current user follows, newest first. */
export async function getFeed(): Promise<Recipe[]> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return [];
  const follows = await prisma.follow.findMany({
    where: { followerId: id },
    select: { followingId: true },
  });
  const authorIds = follows.map((f) => f.followingId);
  if (authorIds.length === 0) return [];
  const rows = await prisma.recipe.findMany({
    where: { authorId: { in: authorIds } },
    orderBy: { createdAt: "desc" },
    include: recipeInclude,
  });
  return rows.map(toRecipe);
}
