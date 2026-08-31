import type { Recipe, RecipeFilters, RecipeSort } from "./types";

/*
 * Search/filter logic. Phase 2 filters in-memory over mock recipes; Phase 4
 * reuses buildRecipeWhere() to produce a Prisma where-clause from the same
 * params. Parsing URL search params lives here so pages and the API agree.
 */

export const PAGE_SIZE = 9;

export const PREP_BUCKETS: { label: string; maxPrep: number }[] = [
  { label: "Under 15 min", maxPrep: 15 },
  { label: "Under 30 min", maxPrep: 30 },
  { label: "Under 60 min", maxPrep: 60 },
];

const SORTS: RecipeSort[] = ["newest", "top", "discussed"];

/** Parse raw URL search params into a normalized RecipeFilters object. */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): RecipeFilters {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const tagsRaw = params.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw
    : tagsRaw
      ? tagsRaw.split(",").filter(Boolean)
      : [];

  const sortRaw = first(params.sort) as RecipeSort | undefined;
  const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "newest";

  const maxPrepRaw = first(params.maxPrep);
  const maxPrep = maxPrepRaw ? Number(maxPrepRaw) : undefined;

  const pageRaw = first(params.page);
  const page = Math.max(1, pageRaw ? Number(pageRaw) : 1);

  return {
    q: first(params.q)?.trim() || undefined,
    category: first(params.category) || undefined,
    tags,
    maxPrep: Number.isFinite(maxPrep) ? maxPrep : undefined,
    sort,
    page: Number.isNaN(page) ? 1 : page,
  };
}

/** Does a recipe match the (non-pagination, non-sort) filters? */
export function matchesFilters(recipe: Recipe, filters: RecipeFilters): boolean {
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const inText =
      recipe.title.toLowerCase().includes(q) ||
      recipe.description.toLowerCase().includes(q);
    if (!inText) return false;
  }
  if (filters.category && recipe.category.slug !== filters.category) {
    return false;
  }
  if (filters.tags && filters.tags.length > 0) {
    const recipeTagSlugs = new Set(recipe.tags.map((t) => t.slug));
    // AND semantics: recipe must have every selected tag.
    if (!filters.tags.every((slug) => recipeTagSlugs.has(slug))) return false;
  }
  if (filters.maxPrep != null && recipe.prepTimeMins > filters.maxPrep) {
    return false;
  }
  return true;
}

export function sortRecipes(recipes: Recipe[], sort: RecipeSort): Recipe[] {
  const copy = [...recipes];
  switch (sort) {
    case "top":
      return copy.sort((a, b) => b.avgRating - a.avgRating);
    case "discussed":
      return copy.sort((a, b) => b.commentCount - a.commentCount);
    case "newest":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

export interface PagedRecipes {
  recipes: Recipe[];
  total: number;
  page: number;
  pageCount: number;
}

/** Full in-memory filter + sort + paginate pipeline (Phase 2 data source). */
export function queryRecipes(
  all: Recipe[],
  filters: RecipeFilters,
): PagedRecipes {
  const filtered = all.filter((r) => matchesFilters(r, filters));
  const sorted = sortRecipes(filtered, filters.sort ?? "newest");
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
