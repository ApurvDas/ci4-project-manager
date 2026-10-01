import { test, expect } from '@playwright/test';
import { signIn, resetData, runSql, liveReady } from './helpers.js';

// The Rust shell can't run in the browser tests, so these plant a stand-in for what Tauri puts on
// `window.__TAURI__` and check exactly what the page asks the shell to do.
const fakeTauri = () => {
    window.__calls = [];
    window.__toasts = [];
    window.__opened = [];
    window.__listeners = {};
    window.__TAURI__ = {
        core: { invoke: (command, args) => { window.__calls.push([command, args]); return Promise.resolve(); } },
        event: { listen: (name, fn) => { window.__listeners[name] = fn; return Promise.resolve(() => {}); } },
        notification: {
            isPermissionGranted: async () => true,
            requestPermission: async () => 'granted',
            sendNotification: (n) => window.__toasts.push(n),
        },
        opener: { openUrl: (url) => { window.__opened.push(url); return Promise.resolve(); } },
    };
};

test.beforeEach(async ({ page }) => {
    resetData();
    await page.addInitScript(fakeTauri);
});

const trayTexts = (page) => page.evaluate(() => window.__calls.filter(([c]) => c === 'tray_timer').map(([, a]) => a.text));
const stored = (page, key) => page.evaluate((k) => new Promise((resolve) => {
    const open = indexedDB.open('pm');
    open.onsuccess = () => {
        const get = open.result.transaction('meta').objectStore('meta').get(k);
        get.onsuccess = () => resolve(get.result?.v);
        get.onerror = () => resolve(undefined);
    };
}), key);

test('the tray shows the running timer, and its Stop timer item stops it', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/task.html?project=1&id=2');
    await page.click('[data-timer="start"]');
    await expect(page.locator('[data-timer="stop"]')).toBeVisible();
    await expect.poll(() => trayTexts(page)).toContainEqual(expect.stringMatching(/^Timer 0:\d\d:\d\d · Build authentication$/));

    await page.evaluate(() => window.__listeners['stop-timer']()); // the tray menu item
    await expect(page.locator('[data-timer="start"]')).toBeVisible();
    await expect.poll(async () => (await trayTexts(page)).at(-1)).toBe('Project Manager');
});

test('a toast for each new notification, but none for what was already there', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard.html');
    await expect.poll(() => stored(page, 'notifiedUpTo')).not.toBeUndefined();
    expect(await page.evaluate(() => window.__toasts)).toEqual([]);
    await liveReady(page);

    runSql(`insert into public.notifications (user_id, type, title, message, related_type, related_id, project_id)
            select id, 'comment_added', 'New comment on a task', 'Build authentication', 'task', 2, 1 from public.profiles where username = 'admin'`);
    await expect.poll(() => page.evaluate(() => window.__toasts), { timeout: 5000 })
        .toEqual([{ title: 'New comment on a task', body: 'Build authentication' }]);
});

test('a task due within the hour is warned about once', async ({ page }) => {
    const soon = new Date(Date.now() + 30 * 60_000);
    const now = new Date();
    test.skip(soon.getDate() !== now.getDate(), 'the half hour ahead is tomorrow');
    const pad = (n) => String(n).padStart(2, '0');
    runSql(`update public.tasks set due_date = '${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}', due_time = '${pad(soon.getHours())}:${pad(soon.getMinutes())}:00', status = 'todo' where id = 2;
            insert into public.task_assignees (task_id, user_id) select 2, id from public.profiles where username = 'admin' on conflict do nothing;`);
    await signIn(page, 'admin'); // lands on the dashboard, where the check runs as the app opens
    await expect.poll(() => page.evaluate(() => window.__toasts.map((t) => t.title))).toContain('Due soon');
    expect(await page.evaluate(() => window.__toasts.find((t) => t.title === 'Due soon').body)).toContain('Build authentication');

    // Reloading doesn't warn again: it remembers.
    await page.reload();
    await expect.poll(() => stored(page, 'warned')).toHaveLength(1);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__toasts.filter((t) => t.title === 'Due soon').length)).toBe(0);
});

test('email-link pages open the website in the default browser instead of the app', async ({ page }) => {
    await page.goto('/login.html');
    await page.getByRole('link', { name: 'use a login link' }).dispatchEvent('click'); // the link wraps onto two lines, so aim at it directly
    await expect.poll(() => page.evaluate(() => window.__opened)).toEqual(['https://apurvdas.github.io/ci4-project-manager/magic-link.html']);
    await expect(page).toHaveURL(/login\.html/);

    await page.getByRole('link', { name: 'Reset it' }).dispatchEvent('click');
    await expect.poll(() => page.evaluate(() => window.__opened.at(-1))).toBe('https://apurvdas.github.io/ci4-project-manager/reset.html');
    await expect(page).toHaveURL(/login\.html/);
});

test('the website itself is untouched: no shell calls, links work normally', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage(); // no stand-in installed
    await page.goto('/login.html');
    await page.getByRole('link', { name: 'use a login link' }).dispatchEvent('click');
    await expect(page).toHaveURL(/magic-link\.html/);
});
