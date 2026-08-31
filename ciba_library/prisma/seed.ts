import { PrismaClient, TagGroup } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  categories,
  tags,
  users,
  recipes,
  commentsByRecipeSlug,
  shoppingList,
  followingIds,
  currentUser,
} from "../src/mocks/data";

/*
 * Seeds a fresh database from the very same mock dataset the Phase 2 UI was
 * built against (src/mocks/data.ts), so the seeded catalog matches the coded
 * frontend exactly. Reusing the mock ids ("u1", "c3", "r5", …) as primary keys
 * keeps every cross-reference (author, category, tags, comment authors,
 * shopping-list source recipes) internally consistent.
 *
 * Ratings don't exist in the mock as rows — only as aggregate avg/count — so we
 * fabricate them: a pool of throwaway "rater" users backs a spread of Rating
 * rows whose mean reproduces each recipe's mock average. The count is capped at
 * the pool size (one rating per user per recipe is enforced by the schema).
 *
 * Idempotent: wipes every table first, so it can be re-run at will.
 */

const prisma = new PrismaClient();

// The four named cooks all share this password so the demo is easy to sign in
// to. Printed at the end of the run.
const DEMO_PASSWORD = "cibademo123";

// How many throwaway users back the fabricated ratings. Caps the visible
// rating count per recipe; 30 is plenty to look lived-in without noise.
const RATER_POOL_SIZE = 30;

const groupToDb: Record<(typeof tags)[number]["group"], TagGroup> = {
  Diet: TagGroup.DIET,
  "Meal Type": TagGroup.MEAL_TYPE,
  Cuisine: TagGroup.CUISINE,
};

/**
 * Build `count` rating values (1–5) whose mean is ~`avg`. Splits between
 * floor(avg) and floor(avg)+1 in the proportion that lands on the target.
 */
function ratingValues(count: number, avg: number): number[] {
  const lo = Math.max(1, Math.min(5, Math.floor(avg)));
  const hi = Math.min(5, lo + 1);
  const hiCount = Math.round((avg - lo) * count);
  return Array.from({ length: count }, (_, k) => (k < hiCount ? hi : lo));
}

async function wipe() {
  // Children first, then parents. (Cascades would cover most of this, but being
  // explicit keeps the intent obvious and the order deterministic.)
  await prisma.shoppingListItem.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.recipeTag.deleteMany();
  await prisma.step.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await wipe();

  // Categories & tags -------------------------------------------------------
  await prisma.category.createMany({
    data: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  });
  await prisma.tag.createMany({
    data: tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      group: groupToDb[t.group],
    })),
  });

  // Named cooks -------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.user.createMany({
    data: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      email: `${u.username}@ciba.test`,
      image: u.image,
      bio: u.bio,
      passwordHash,
    })),
  });

  // Throwaway raters (no password; exist only to own Rating rows) ------------
  const raterIds = Array.from(
    { length: RATER_POOL_SIZE },
    (_, i) => `rater${i + 1}`,
  );
  await prisma.user.createMany({
    data: raterIds.map((id, i) => ({
      id,
      name: `Community Cook ${i + 1}`,
      username: id,
      email: `${id}@ciba.test`,
    })),
  });

  // Recipes (+ ingredients, steps, tags) ------------------------------------
  for (const r of recipes) {
    await prisma.recipe.create({
      data: {
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        authorId: r.author.id,
        categoryId: r.category.id,
        servings: r.servings,
        prepTimeMins: r.prepTimeMins,
        cookTimeMins: r.cookTimeMins,
        difficulty: r.difficulty,
        imageUrl: r.imageUrl,
        imageHue: r.imageHue,
        createdAt: new Date(r.createdAt),
        ingredients: {
          create: r.ingredients.map((ing, i) => ({
            id: ing.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            order: i,
          })),
        },
        steps: {
          create: r.steps.map((s) => ({
            stepNumber: s.stepNumber,
            instruction: s.instruction,
          })),
        },
        tags: { create: r.tags.map((t) => ({ tagId: t.id })) },
      },
    });
  }

  // Fabricated ratings ------------------------------------------------------
  const ratingRows = recipes.flatMap((r) => {
    const count = Math.min(r.ratingCount, raterIds.length);
    return ratingValues(count, r.avgRating).map((value, k) => ({
      recipeId: r.id,
      userId: raterIds[k],
      value,
    }));
  });
  await prisma.rating.createMany({ data: ratingRows });

  // Comments ----------------------------------------------------------------
  const slugToId = new Map(recipes.map((r) => [r.slug, r.id]));
  const commentRows = Object.entries(commentsByRecipeSlug).flatMap(
    ([slug, comments]) => {
      const recipeId = slugToId.get(slug);
      if (!recipeId) return [];
      return comments.map((c) => ({
        id: c.id,
        recipeId,
        userId: c.author.id,
        body: c.body,
        createdAt: new Date(c.createdAt),
      }));
    },
  );
  await prisma.comment.createMany({ data: commentRows });

  // Follows (the current demo user follows a couple of cooks) ---------------
  await prisma.follow.createMany({
    data: [...followingIds].map((followingId) => ({
      followerId: currentUser.id,
      followingId,
    })),
  });

  // Shopping list for the current demo user ---------------------------------
  await prisma.shoppingListItem.createMany({
    data: shoppingList.map((item) => ({
      id: item.id,
      userId: currentUser.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      checked: item.checked,
      recipeId: item.recipeSlug ? slugToId.get(item.recipeSlug) ?? null : null,
    })),
  });

  console.log(
    `Seeded ${categories.length} categories, ${tags.length} tags, ` +
      `${users.length} cooks (+${raterIds.length} raters), ` +
      `${recipes.length} recipes, ${ratingRows.length} ratings, ` +
      `${commentRows.length} comments.`,
  );
  console.log(
    `Sign in as any cook — e.g. mara@ciba.test / ${DEMO_PASSWORD}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
