import { test, expect } from '@playwright/test';
import { signIn, resetData } from './helpers.js';

const TASK = '/task.html?project=1&id=2'; // Build authentication, developer is a member

test.describe('Time tracking', () => {
    test.beforeEach(() => resetData());

    test('log time, run a timer, and compare with the estimate', async ({ page }) => {
        await signIn(page, 'developer');
        await page.goto('/task-form.html?project=1&id=2');
        await page.fill('#estimate', '4');
        await page.click('button[type="submit"]');
        await expect(page.locator('.alert-success')).toContainText('Task updated');

        const card = page.locator('[data-time-card]');
        await card.locator('#log-hours').fill('1.5');
        await card.locator('#log-note').fill('Pairing');
        await card.locator('form.time-log button[type="submit"]').click();
        await expect(page.locator('.alert-success')).toContainText('Logged 1h 30m.');
        await expect(card).toContainText('1h 30m / 4h');
        await expect(card).toContainText('Pairing');

        await card.locator('[data-timer="start"]').click();
        await expect(page.locator('[data-time-card] .time-running')).toBeVisible();
        await page.locator('[data-time-card] [data-timer="stop"]').click();
        await expect(page.locator('[data-time-card] [data-timer="start"]')).toBeVisible();
        await expect(page.locator('[data-time-card] .time-running')).toHaveCount(0);
    });
});

test.describe('Analytics and search', () => {
    test.beforeEach(() => resetData());

    test('the analytics page shows stats and three charts with table views', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/project.html?id=1');
        await page.getByRole('link', { name: 'Analytics' }).click();
        await expect(page.locator('h1')).toHaveText('Analytics');
        await expect(page.locator('.stat')).toHaveCount(4);
        await expect(page.locator('svg.chart')).toHaveCount(2);
        await expect(page.locator('details.chart-table')).toHaveCount(2);
        await expect(page.getByText('Time logged by member')).toBeVisible();
    });

    test('search finds a task and highlights the match', async ({ page }) => {
        await signIn(page, 'developer');
        await page.goto('/dashboard.html');
        await page.getByRole('link', { name: 'Search' }).click();
        await page.fill('#q', 'auth');
        await page.keyboard.press('Enter');
        const result = page.locator('.search-result', { hasText: 'Build authentication' });
        await expect(result).toBeVisible();
        await expect(result.locator('mark')).toContainText('authentication');
    });
});

test.describe('Header fits every width', () => {
    for (const [width, height] of [[779, 852], [820, 1180], [1000, 700]]) {
        test(`${width}x${height}: no sideways scroll, sign out and clock on screen`, async ({ page }) => {
            await page.setViewportSize({ width, height });
            await signIn(page, 'IronWarrior');
            await page.goto('/project.html?id=1');
            await expect(page.locator('h1')).toBeVisible();
            const r = await page.evaluate(() => {
                const vw = document.documentElement.clientWidth;
                const so = [...document.querySelectorAll('.app-header button, .app-header a')].find((el) => el.textContent.includes('Sign out')).getBoundingClientRect();
                const c = document.querySelector('.clock').getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth - vw, signOut: so.right <= vw, clock: c.right <= vw && c.bottom <= innerHeight };
            });
            expect(r).toEqual({ overflow: 0, signOut: true, clock: true });
        });
    }
});

test.describe('Wandering eyes loader', () => {
    const slow = (page, glob) => page.route(glob, async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
    });

    test('shows while a page loads its data, then gives way to the content', async ({ page }) => {
        await signIn(page, 'admin');
        await slow(page, '**/rpc/project_analytics');
        await page.goto('/analytics.html?project=1');
        const eyes = page.locator('#content .eyes[role="status"]');
        await expect(eyes).toBeVisible();
        await expect(eyes).toHaveText('Loading…'); // read out by the status live region
        await expect(eyes.locator('.eyes__eye')).toHaveCount(2);
        // Drawn in the site's muted ink, whichever theme is on.
        const [ink, muted] = await eyes.evaluate((el) => {
            const probe = document.body.appendChild(Object.assign(document.createElement('span'), { style: 'color: var(--text-muted)' }));
            const colours = [getComputedStyle(el).color, getComputedStyle(probe).color];
            probe.remove();
            return colours;
        });
        await page.screenshot({ path: 'test-results/eyes-page.png' });
        await expect(page.locator('h1')).toHaveText('Analytics');
        await expect(eyes).toHaveCount(0);
        expect(ink).toBe(muted);
    });

    test('the eyes show from first paint, before any script has loaded', async ({ page }) => {
        await page.route('**/*.js', () => new Promise(() => {})); // scripts never arrive
        await page.goto('/project.html?id=1', { waitUntil: 'commit' });
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.body, '::before').width)).toBe('44px');
        expect(await page.evaluate(() => getComputedStyle(document.body, '::after').width)).toBe('44px');
    });

    test('a busy submit button shows small eyes beside its busy label', async ({ page }) => {
        await signIn(page, 'developer');
        await page.goto('/task-form.html?project=1&id=2');
        await slow(page, '**/rpc/save_task');
        await page.click('button[type="submit"]');
        const button = page.locator('button[type="submit"]');
        await expect(button).toContainText('Saving…');
        await expect(button.locator('.eyes--inline .eyes__eye')).toHaveCount(2);
        await page.screenshot({ path: 'test-results/eyes-button.png', clip: await button.boundingBox() });
        await expect(page.locator('.alert-success')).toContainText('Task updated');
    });
});
