// @ts-check
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');

/** Every seeded account shares this password. Development data only. */
const PASSWORD = 'Password123!';

/**
 * Restore the seeded data.
 *
 * These tests drive the real application against the real development
 * database, so a test that moves a card leaves the board changed for whatever
 * runs next. Call this from beforeEach in any suite that writes, or tests will
 * pass alone and fail together — which is worse than failing outright, because
 * it looks like flakiness.
 */
function resetData() {
  execFileSync('php', ['spark', 'db:seed', 'DevelopmentSeeder'], {
    cwd: __dirname + '/../..',
    stdio: 'pipe',
  });
}

/**
 * Sign in through the real form, rather than by forging a session cookie.
 *
 * Slower, but it means the login screen itself is exercised by every test that
 * needs a user, and a break in authentication cannot hide behind a shortcut.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'admin'|'manager'|'developer'|'designer'|'tester'} username
 */
async function signIn(page, username) {
  // Drop any existing session first. Visiting /login while already signed in
  // redirects to the dashboard, so without this a test that switches user
  // silently keeps the previous one — which makes a permission test pass for
  // entirely the wrong reason.
  await page.context().clearCookies();

  await page.goto('/login');

  await page.fill('input[name="email"]', `${username}@example.test`);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Landing on the dashboard is the signal the session was established.
  await expect(page.locator('.user-chip')).toContainText(username);
}

module.exports = { signIn, resetData, PASSWORD };
