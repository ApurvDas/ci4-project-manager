import { test, expect } from '@playwright/test';
import { signIn, resetData, liveReady } from './helpers.js';

test.beforeEach(() => resetData());

test('a change made in one window shows up in another within two seconds, with no reload', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await signIn(a, 'admin');
    await signIn(b, 'manager'); // both belong to Website Redesign

    // Wait for the live connection to be subscribed, rather than guessing how long that takes.
    const subscribed = new Promise((resolve) => b.on('websocket', (ws) => ws.on('framereceived', (frame) => {
        if (String(frame.payload).includes('Subscribed to PostgreSQL')) resolve();
    })));
    await b.goto('/project.html?id=1');
    const row = b.locator('.list-item', { hasText: 'Build authentication' });
    await expect(row).toBeVisible();
    const taskId = new URL(await row.getByRole('link').getAttribute('href'), b.url()).searchParams.get('id');
    await b.evaluate(() => { window.__sameDocument = true; });
    await subscribed;
    await liveReady(b);

    await a.goto(`/task-form.html?project=1&id=${taskId}`);
    await a.fill('input[name="title"]', 'Build authentication, take two');
    await a.click('button[type="submit"]');
    await expect(a.locator('h1')).toHaveText('Build authentication, take two');

    await expect(b.locator('.list-item', { hasText: 'Build authentication, take two' })).toBeVisible({ timeout: 2000 });
    expect(await b.evaluate(() => window.__sameDocument)).toBe(true); // no reload happened
});
