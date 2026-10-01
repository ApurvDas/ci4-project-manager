import { test, expect } from '@playwright/test';
import { signIn, resetData } from './helpers.js';

// The stamped copy of the site (tests/stamped-server.mjs), the only place the service worker registers.
test.use({ baseURL: 'http://localhost:8124' });

test.beforeEach(() => resetData());

test('pages open offline from the local copy and the cached app', async ({ page, context }) => {
    await signIn(page, 'admin');
    await page.goto('/project.html?id=1');
    await expect(page.locator('h1')).toHaveText('Website Redesign');

    // The worker caches the whole app when it installs.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => (await (await caches.open('pm-e2e')).keys()).length)).toBeGreaterThan(40);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Website Redesign');
    await expect(page.locator('.list-item', { hasText: 'Build authentication' })).toBeVisible();

    // A page never opened before works too, because everything was cached up front.
    await page.goto('/tasks.html?project=1');
    await expect(page.locator('.list-item', { hasText: 'Build authentication' })).toBeVisible();
    await page.goto('/dashboard.html');
    await expect(page.locator('.list-item', { hasText: 'Website Redesign' }).first()).toBeVisible();

    // Pages the server works out say so instead of failing.
    await page.goto('/analytics.html?project=1');
    await expect(page.getByText('Needs a connection')).toBeVisible();
});

test('signing out wipes the local copy, so the next person never sees it', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard.html');
    await expect(page.locator('.list-item', { hasText: 'Website Redesign' }).first()).toBeVisible();
    await page.click('[data-sign-out]');
    await expect(page).toHaveURL(/login\.html/);
    const rows = await page.evaluate(() => new Promise((resolve) => {
        const open = indexedDB.open('pm');
        open.onsuccess = () => {
            const tx = open.result.transaction(['projects', 'meta']);
            const count = tx.objectStore('projects').count();
            tx.oncomplete = () => resolve(count.result);
        };
    }));
    expect(rows).toBe(0);
});
