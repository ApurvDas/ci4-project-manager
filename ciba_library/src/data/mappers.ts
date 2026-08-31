import "server-only";
import { Prisma, type TagGroup as DbTagGroup } from "@prisma/client";
import type {
  Category,
  Comment,
  Recipe,
  ShoppingListItem,
  Tag,
  TagGroup,
  UserSummary,
} from "@/lib/types";

/*
 * Maps Prisma rows onto the decoupled domain types in src/lib/types. The UI
 * never sees a Prisma object — the data-access layer runs rows through here so
 * swapping the data source (mock -> DB) leaves pages and components untouched.
 */

export const tagGroupToDomain: Record<DbTagGroup, TagGroup> = {
  DIET: "Diet",
  MEAL_TYPE: "Meal Type",
  CUISINE: "Cuisine",
};

export const tagGroupToDb: Record<TagGroup, DbTagGroup> = {
  Diet: "DIET",
  "Meal Type": "MEAL_TYPE",
  Cuisine: "CUISINE",
};

/** Canonical include for a fully-hydrated recipe (author, taxonomy, aggregates). */
export const recipeInclude = {
  author: true,
  category: true,
  tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
  ingredients: { orderBy: { order: "asc" } },
  steps: { orderBy: { stepNumber: "asc" } },
  ratings: { select: { value: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.RecipeInclude;

type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

export function toUserSummary(u: {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio?: string | null;
}): UserSummary {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio ?? null,
  };
}

export function toCategory(c: {
  id: string;
  name: string;
  slug: string;
}): Category {
  return { id: c.id, name: c.name, slug: c.slug };
}

export function toTag(t: {
  id: string;
  name: string;
  slug: string;
  group: DbTagGroup;
}): Tag {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    group: tagGroupToDomain[t.group],
  };
}

export function toRecipe(r: RecipeRow): Recipe {
  const ratingCount = r.ratings.length;
  const avgRating =
    ratingCount === 0
      ? 0
      : r.ratings.reduce((sum, rt) => sum + rt.value, 0) / ratingCount;

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    author: toUserSummary(r.author),
    servings: r.servings,
    prepTimeMins: r.prepTimeMins,
    cookTimeMins: r.cookTimeMins,
    difficulty: r.difficulty,
    imageUrl: r.imageUrl,
    imageHue: r.imageHue,
    category: toCategory(r.category),
    tags: r.tags.map((rt) => toTag(rt.tag)),
    ingredients: r.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      notes: i.notes,
    })),
    steps: r.steps.map((s) => ({
      stepNumber: s.stepNumber,
      instruction: s.instruction,
    })),
    avgRating,
    ratingCount,
    commentCount: r._count.comments,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toComment(c: {
  id: string;
  body: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    username: string;
    image: string | null;
    bio?: string | null;
  };
}): Comment {
  return {
    id: c.id,
    author: toUserSummary(c.user),
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toShoppingListItem(i: {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
  recipe: { slug: string; title: string } | null;
}): ShoppingListItem {
  return {
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    checked: i.checked,
    recipeSlug: i.recipe?.slug ?? null,
    recipeTitle: i.recipe?.title ?? null,
  };
}
