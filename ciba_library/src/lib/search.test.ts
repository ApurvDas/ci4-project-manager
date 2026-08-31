import { describe, it, expect } from "vitest";
import {
  parseFilters,
  matchesFilters,
  sortRecipes,
  queryRecipes,
  PAGE_SIZE,
} from "./search";
import type { Recipe, Category, Tag } from "./types";

const cat = (slug: string): Category => ({ id: slug, name: slug, slug });
const tag = (slug: string): Tag => ({ id: slug, name: slug, slug, group: "Diet" });

let seq = 0;
function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  seq += 1;
  return {
    id: `r${seq}`,
    slug: `r${seq}`,
    title: `Recipe ${seq}`,
    description: "a tasty dish",
    author: { id: "u1", name: "Cook", username: "cook", image: null },
    servings: 2,
    prepTimeMins: 20,
    cookTimeMins: 20,
    difficulty: "EASY",
    imageUrl: null,
    imageHue: 18,
    category: cat("mains"),
    tags: [],
    ingredients: [],
    steps: [],
    avgRating: 0,
    ratingCount: 0,
    commentCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseFilters", () => {
  it("defaults sensibly on empty input", () => {
    expect(parseFilters({})).toEqual({
      q: undefined,
      category: undefined,
      tags: [],
      maxPrep: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("splits a comma-joined tags string", () => {
    expect(parseFilters({ tags: "vegan,quick" }).tags).toEqual(["vegan", "quick"]);
  });

  it("keeps an array of tags as-is", () => {
    expect(parseFilters({ tags: ["a", "b"] }).tags).toEqual(["a", "b"]);
  });

  it("rejects an unknown sort, falling back to newest", () => {
    expect(parseFilters({ sort: "bogus" }).sort).toBe("newest");
    expect(parseFilters({ sort: "top" }).sort).toBe("top");
  });

  it("clamps page to a minimum of 1 and recovers from NaN", () => {
    expect(parseFilters({ page: "0" }).page).toBe(1);
    expect(parseFilters({ page: "-5" }).page).toBe(1);
    expect(parseFilters({ page: "3" }).page).toBe(3);
    expect(parseFilters({ page: "abc" }).page).toBe(1);
  });

  it("trims the query and drops empty strings", () => {
    expect(parseFilters({ q: "  soup  " }).q).toBe("soup");
    expect(parseFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("matchesFilters", () => {
  it("matches the query against title and description", () => {
    const r = makeRecipe({ title: "Lentil Dal", description: "warming" });
    expect(matchesFilters(r, { q: "lentil" })).toBe(true);
    expect(matchesFilters(r, { q: "warming" })).toBe(true);
    expect(matchesFilters(r, { q: "pizza" })).toBe(false);
  });

  it("filters by category slug", () => {
    const r = makeRecipe({ category: cat("desserts") });
    expect(matchesFilters(r, { category: "desserts" })).toBe(true);
    expect(matchesFilters(r, { category: "mains" })).toBe(false);
  });

  it("requires every selected tag (AND semantics)", () => {
    const r = makeRecipe({ tags: [tag("vegan"), tag("quick")] });
    expect(matchesFilters(r, { tags: ["vegan"] })).toBe(true);
    expect(matchesFilters(r, { tags: ["vegan", "quick"] })).toBe(true);
    expect(matchesFilters(r, { tags: ["vegan", "gluten-free"] })).toBe(false);
  });

  it("respects the maxPrep ceiling", () => {
    const r = makeRecipe({ prepTimeMins: 45 });
    expect(matchesFilters(r, { maxPrep: 60 })).toBe(true);
    expect(matchesFilters(r, { maxPrep: 30 })).toBe(false);
  });
});

describe("sortRecipes", () => {
  it("sorts top by average rating desc", () => {
    const a = makeRecipe({ avgRating: 3 });
    const b = makeRecipe({ avgRating: 5 });
    expect(sortRecipes([a, b], "top").map((r) => r.avgRating)).toEqual([5, 3]);
  });

  it("sorts discussed by comment count desc", () => {
    const a = makeRecipe({ commentCount: 1 });
    const b = makeRecipe({ commentCount: 9 });
    expect(sortRecipes([a, b], "discussed").map((r) => r.commentCount)).toEqual([9, 1]);
  });

  it("sorts newest by createdAt desc", () => {
    const old = makeRecipe({ createdAt: "2020-01-01T00:00:00.000Z" });
    const fresh = makeRecipe({ createdAt: "2026-01-01T00:00:00.000Z" });
    expect(sortRecipes([old, fresh], "newest")[0]).toBe(fresh);
  });

  it("does not mutate the input array", () => {
    const list = [makeRecipe({ avgRating: 1 }), makeRecipe({ avgRating: 2 })];
    const before = [...list];
    sortRecipes(list, "top");
    expect(list).toEqual(before);
  });
});

describe("queryRecipes", () => {
  it("paginates by PAGE_SIZE and reports totals", () => {
    const all = Array.from({ length: PAGE_SIZE * 2 + 3 }, () => makeRecipe());
    const p1 = queryRecipes(all, { sort: "newest", page: 1 });
    expect(p1.recipes).toHaveLength(PAGE_SIZE);
    expect(p1.total).toBe(all.length);
    expect(p1.pageCount).toBe(3);

    const p3 = queryRecipes(all, { sort: "newest", page: 3 });
    expect(p3.recipes).toHaveLength(3);
  });

  it("applies filters before paginating", () => {
    const all = [
      makeRecipe({ category: cat("mains") }),
      makeRecipe({ category: cat("desserts") }),
      makeRecipe({ category: cat("desserts") }),
    ];
    const res = queryRecipes(all, { category: "desserts", page: 1 });
    expect(res.total).toBe(2);
    expect(res.pageCount).toBe(1);
  });

  it("always reports at least one page, even when empty", () => {
    expect(queryRecipes([], { page: 1 }).pageCount).toBe(1);
  });
});
