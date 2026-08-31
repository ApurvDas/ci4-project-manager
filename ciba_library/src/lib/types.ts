/*
 * Domain types shared across the app. These deliberately mirror the Prisma
 * models (Phase 3) but stay decoupled so the UI never imports Prisma directly.
 * The data-access layer in src/data maps DB rows -> these shapes.
 */

export type TagGroup = "Diet" | "Meal Type" | "Cuisine";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  group: TagGroup;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
}

export interface Step {
  stepNumber: number;
  instruction: string;
}

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio?: string | null;
}

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: UserSummary;
  servings: number;
  prepTimeMins: number;
  cookTimeMins: number;
  difficulty: Difficulty;
  imageUrl: string | null;
  imageHue: number; // drives the generated placeholder graphic
  category: Category;
  tags: Tag[];
  ingredients: Ingredient[];
  steps: Step[];
  avgRating: number;
  ratingCount: number;
  commentCount: number;
  createdAt: string; // ISO
}

export interface Comment {
  id: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
  recipeSlug: string | null;
  recipeTitle: string | null;
}

export type RecipeSort = "newest" | "top" | "discussed";

export interface RecipeFilters {
  q?: string;
  category?: string; // slug
  tags?: string[]; // slugs
  maxPrep?: number;
  sort?: RecipeSort;
  page?: number;
}
