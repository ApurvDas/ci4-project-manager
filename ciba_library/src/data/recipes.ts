import "server-only";
import { Prisma } from "@prisma/client";
import type { Recipe, RecipeFilters } from "@/lib/types";
import { PAGE_SIZE, sortRecipes, type PagedRecipes } from "@/lib/search";
import { prisma } from "@/lib/db";
import { recipeInclude, toRecipe } from "./mappers";

/*
 * Recipe data-access layer (Prisma). Signatures match the Phase 2 mock layer so
 * pages and components need no changes. Filtering happens in the DB via
 * buildRecipeWhere(); sorting/pagination reuse the shared helpers in lib/search
 * so behavior stays identical to the in-memory version.
 */

/** Translate normalized filters into a Prisma where-clause (AND semantics). */
export function buildRecipeWhere(
  filters: RecipeFilters,
): Prisma.RecipeWhereInput {
  const and: Prisma.RecipeWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.category) {
    and.push({ category: { slug: filters.category } });
  }
  if (filters.tags?.length) {
    // AND semantics: one `some` clause per selected tag.
    for (const slug of filters.tags) {
      and.push({ tags: { some: { tag: { slug } } } });
    }
  }
  if (filters.maxPrep != null) {
    and.push({ prepTimeMins: { lte: filters.maxPrep } });
  }

  return and.length ? { AND: and } : {};
}

export async function getRecipes(
  filters: RecipeFilters,
): Promise<PagedRecipes> {
  const rows = await prisma.recipe.findMany({
    where: buildRecipeWhere(filters),
    include: recipeInclude,
  });
  const sorted = sortRecipes(rows.map(toRecipe), filters.sort ?? "newest");

  const page = filters.page ?? 1;
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  return {
    recipes: sorted.slice(start, start + PAGE_SIZE),
    total,
    page,
    pageCount,
  };
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  const row = await prisma.recipe.findUnique({
    where: { slug },
    include: recipeInclude,
  });
  return row ? toRecipe(row) : null;
}

export async function getRecentRecipes(limit = 6): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: recipeInclude,
  });
  return rows.map(toRecipe);
}

export async function getTopRecipes(limit = 3): Promise<Recipe[]> {
  // Average rating can't be ordered in SQL via Prisma, so sort the mapped rows.
  const rows = await prisma.recipe.findMany({ include: recipeInclude });
  return sortRecipes(rows.map(toRecipe), "top").slice(0, limit);
}

export async function getRecipesByAuthor(username: string): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany({
    where: { author: { username } },
    orderBy: { createdAt: "desc" },
    include: recipeInclude,
  });
  return rows.map(toRecipe);
}
