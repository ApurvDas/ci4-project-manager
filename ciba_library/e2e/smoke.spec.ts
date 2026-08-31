import { test, expect } from "@playwright/test";

// Seeded credentials (see prisma/seed.ts output).
const SEED_EMAIL = "mara@ciba.test";
const SEED_PASSWORD = "cibademo123";

// A recipe card link, excluding the "new recipe" action.
const recipeLink = 'a[href^="/recipes/"]:not([href="/recipes/new"])';

test("home surfaces recipe links", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Ciba Library/);
  await expect(page.locator(recipeLink).first()).toBeVisible();
});

test("browse to a recipe detail page", async ({ page }) => {
  await page.goto("/recipes");
  const first = page.locator(recipeLink).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  // The detail page shows the ingredients / servings control.
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
});

test("servings scaler increments the serving count", async ({ page }) => {
  await page.goto("/recipes");
  await page.locator(recipeLink).first().click();

  const servingLine = page.getByText(/Scaled for\s+\d+\s+serving/);
  await expect(servingLine).toBeVisible();
  const before = Number((await servingLine.innerText()).match(/\d+/)![0]);

  await page.getByLabel("More servings").click();
  await expect(
    page.getByText(new RegExp(`Scaled for\\s+${before + 1}\\s+serving`)),
  ).toBeVisible();
});

test("sign in with seeded credentials reaches the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(SEED_EMAIL);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});
