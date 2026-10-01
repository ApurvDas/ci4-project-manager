import { test, expect } from '@playwright/test';
import { signIn, resetData, runSql } from './helpers.js';

// The stamped copy of the site (tests/stamped-server.mjs): the only place the service worker, and so offline navigation, works.
test.use({ baseURL: 'http://localhost:8124' });
test.setTimeout(90_000);

test.beforeEach(() => resetData());

const pill = (page) => page.locator('[data-sync-pill]');

// Open a page and wait until the worker has cached the whole app, so it can navigate offline.
async function readyOffline(page, url) {
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(async () => (await (await caches.open('pm-e2e')).keys()).length)).toBeGreaterThan(40);
}

async function newContextPage(browser, user) {
    const context = await browser.newContext({ baseURL: 'http://localhost:8124' });
    const page = await context.newPage();
    await signIn(page, user);
    return { context, page };
}

test('everything done offline reaches the server when the connection returns', async ({ page, context, browser }) => {
    await signIn(page, 'admin');
    await readyOffline(page, '/project.html?id=1');
    await context.setOffline(true);

    // Create a task, add and tick a checklist item, comment and log time: all without a connection.
    await page.goto('/task-form.html?project=1');
    await page.fill('input[name="title"]', 'Written on a plane');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Written on a plane');
    await expect(page).toHaveURL(/id=-\d+/); // a temporary id until the server assigns one

    await page.fill('#checklist-items', 'Pack the laptop');
    await page.click('form[data-action="add-items"] button[type="submit"]');
    await expect(page.locator('.checklist-item', { hasText: 'Pack the laptop' })).toBeVisible();
    await page.locator('.checklist-box[data-toggle-item]').click();
    await expect(page.locator('[data-checklist-progress]')).toContainText('1/1');

    await page.fill('#comment', 'Typed at 30,000 feet');
    await page.click('form[data-action="comment"] button[type="submit"]');
    await expect(page.locator('.activity-body', { hasText: 'Typed at 30,000 feet' })).toBeVisible();
    await page.fill('#log-hours', '1.5');
    await page.click('form[data-action="log-time"] button[type="submit"]');
    await expect(page.locator('[data-time-card] .badge').first()).toContainText('1h 30m');

    await expect(pill(page)).toHaveAttribute('data-state', 'waiting');
    await expect(pill(page)).toContainText('5 waiting');

    // Back online: the edits go up in order, and the page ends on the real id.
    await context.setOffline(false);
    await expect(pill(page)).toHaveAttribute('data-state', 'synced', { timeout: 15_000 });
    await expect(page).toHaveURL(/id=\d+/);
    await expect(page.locator('h1')).toHaveText('Written on a plane');
    await expect(page.locator('[data-checklist-progress]')).toContainText('1/1');

    // Someone else sees it all.
    const other = await newContextPage(browser, 'manager');
    await other.page.goto('/tasks.html?project=1');
    await other.page.getByRole('link', { name: 'Written on a plane' }).click();
    await expect(other.page.locator('.checklist-item.is-done', { hasText: 'Pack the laptop' })).toBeVisible();
    await expect(other.page.locator('.activity-body', { hasText: 'Typed at 30,000 feet' })).toBeVisible();
    await expect(other.page.locator('[data-time-card] .badge').first()).toContainText('1h 30m');
    await other.context.close();
});

test('different fields changed on each side are both kept', async ({ page, context, browser }) => {
    await signIn(page, 'admin');
    await page.goto('/task-form.html?project=1&id=2'); // Build authentication
    await page.evaluate(() => navigator.serviceWorker.ready);
    await readyOffline(page, '/task-form.html?project=1&id=2');
    await context.setOffline(true);
    await page.fill('input[name="due_date"]', '2031-05-05');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Build authentication');

    // Meanwhile, online, the manager changes the status.
    const other = await newContextPage(browser, 'manager');
    await other.page.goto('/task-form.html?project=1&id=2');
    await other.page.selectOption('select[name="status"]', 'review');
    await other.page.click('button[type="submit"]');
    await expect(other.page.locator('h1')).toHaveText('Build authentication');

    await context.setOffline(false);
    await expect(pill(page)).toHaveAttribute('data-state', 'synced', { timeout: 15_000 });
    await expect(page.locator('.badge-status-review')).toBeVisible(); // the manager's change arrived
    await expect(page.locator('dl.meta-list')).toContainText('5 May 2031'); // and ours is still there
    await other.context.close();
});

for (const [order, offlineEditsLater, expectTitle, expectNotice] of [
    ['the later edit wins: ours was made after theirs', true, 'Offline title', /replaced/],
    ['the later edit wins: theirs was made after ours', false, 'Online title', /older/],
]) {
    test(`the same field changed on both sides: ${order}`, async ({ page, context, browser }) => {
        await signIn(page, 'admin');
        await readyOffline(page, '/task-form.html?project=1&id=2');
        await context.setOffline(true);

        const other = await newContextPage(browser, 'manager');
        const editOnline = async () => {
            await other.page.goto('/task-form.html?project=1&id=2');
            await other.page.fill('input[name="title"]', 'Online title');
            await other.page.click('button[type="submit"]');
            await expect(other.page.locator('h1')).toHaveText('Online title');
        };
        const editOffline = async () => {
            await page.fill('input[name="title"]', 'Offline title');
            await page.click('button[type="submit"]');
            await expect(page.locator('h1')).toHaveText('Offline title');
        };
        if (offlineEditsLater) { await editOnline(); await page.waitForTimeout(1100); await editOffline(); }
        else { await editOffline(); await page.waitForTimeout(1100); await editOnline(); }

        await context.setOffline(false);
        await expect(pill(page)).toHaveAttribute('data-state', 'synced', { timeout: 15_000 });
        await expect(page.locator('#alerts .alert-info')).toContainText(expectNotice);
        await expect(page.locator('h1')).toHaveText(expectTitle);
        await other.context.close();
    });
}

test('an edit the server refuses is listed as a problem, and can be discarded', async ({ browser }) => {
    const { context, page } = await newContextPage(browser, 'manager');
    await readyOffline(page, '/task-form.html?project=1&id=2');
    await context.setOffline(true);
    await page.fill('input[name="title"]', 'Edited after losing access');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Edited after losing access');
    await expect(pill(page)).toContainText('1 waiting');

    // While the manager is offline, they are removed from the project.
    runSql("delete from public.project_members where project_id = 1 and user_id = (select id from public.profiles where username = 'manager')");
    await context.setOffline(false);

    await expect(pill(page)).toHaveAttribute('data-state', 'problem', { timeout: 15_000 });
    await pill(page).click();
    await expect(page.locator('[data-sync-panel]')).toContainText('Edit task');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(pill(page)).toHaveAttribute('data-state', 'synced');
    await context.close();
});

test('a project, a tag and a task that uses it, all made offline, arrive together', async ({ page, context, browser }) => {
    await signIn(page, 'admin');
    await readyOffline(page, '/dashboard.html');
    await context.setOffline(true);

    await page.goto('/project-form.html');
    await page.fill('input[name="name"]', 'Planned on a train');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Planned on a train');
    await expect(page).toHaveURL(/id=-\d+/);

    await page.locator('form.tag-option button[aria-label="Add tag Bug"]').click();
    await expect(page.locator('.tag-list .tag', { hasText: 'Bug' })).toBeVisible();

    await page.getByRole('link', { name: 'New task' }).first().click();
    await page.fill('input[name="title"]', 'Child of an unsaved project');
    await page.getByLabel('Bug').check();
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Child of an unsaved project');
    await expect(pill(page)).toContainText('3 waiting');

    await context.setOffline(false);
    await expect(pill(page)).toHaveAttribute('data-state', 'synced', { timeout: 15_000 });
    await expect(page).toHaveURL(/project=\d+&id=\d+/);

    const other = await newContextPage(browser, 'IronWarrior'); // a site admin sees every project
    await other.page.goto('/projects.html');
    await other.page.getByRole('link', { name: 'Planned on a train' }).click();
    await expect(other.page.locator('.list-item', { hasText: 'Child of an unsaved project' })).toBeVisible();
    await expect(other.page.locator('.tag-list .tag', { hasText: 'Bug' })).toBeVisible();
    await other.context.close();
});

test('online, an edit the server refuses is reported on the form and nothing is left waiting', async ({ browser }) => {
    const { context, page } = await newContextPage(browser, 'manager');
    await page.goto('/task-form.html?project=1&id=2');
    await expect(page.locator('input[name="title"]')).toHaveValue('Build authentication');

    // The manager loses access while the form is open.
    runSql("delete from public.project_members where project_id = 1 and user_id = (select id from public.profiles where username = 'manager')");
    await page.fill('input[name="title"]', 'Not allowed any more');
    await page.click('button[type="submit"]');

    await expect(page.locator('#alerts .alert-error')).toContainText('could not be found');
    await expect(pill(page)).toHaveAttribute('data-state', 'synced');
    await context.close();
});
