import { defineConfig, devices } from "@playwright/test";

// e2e smoke: exercises the core flow (browse, filter, detail, scale servings,
// sign in) against a real dev server + Postgres. Runs with reduced motion so
// the anime.js number tweens settle instantly and assertions stay stable.
const PORT = 3210;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Dev-mode compiles each route on first visit; give assertions room to
  // outlast that lag (production builds render instantly).
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Reuse the running dev server locally; start one in CI. The DB (Docker
  // Postgres) must be up either way — the browse/detail pages are DB-backed.
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
