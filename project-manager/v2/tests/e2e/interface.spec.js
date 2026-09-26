import { test, expect } from '@playwright/test';
import { signIn, resetData } from './helpers.js';

test.describe('Checklist', () => {
    const TASK = '/task.html?project=1&id=2'; // Build authentication: 4 items, 2 ticked

    test.beforeEach(async ({ page }) => {
        resetData();
        await signIn(page, 'admin');
        await page.goto(TASK);
    });

    test('ticking an item updates the progress badge without reloading', async ({ page }) => {
        const badge = page.locator('[data-checklist-progress]');
        await expect(badge).toContainText('2/4');
        await page.evaluate(() => { window.__stillTheSameDocument = true; });
        const item = page.locator('.checklist-item', { hasText: 'Forgot password' });
        await item.locator('.checklist-box').click();
        await expect(badge).toContainText('3/4');
        await expect(item).toHaveClass(/is-done/);
        expect(await page.evaluate(() => window.__stillTheSameDocument)).toBe(true);
    });

    test('a tick survives a reload, so it reached the database', async ({ page }) => {
        await page.locator('.checklist-item', { hasText: 'Forgot password' }).locator('.checklist-box').click();
        await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');
        await page.reload();
        await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');
    });

    test('two ticks in a row both land', async ({ page }) => {
        await page.locator('.checklist-item', { hasText: 'Forgot password' }).locator('.checklist-box').click();
        await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');
        await page.locator('.checklist-item', { hasText: 'Email verification' }).locator('.checklist-box').click();
        await expect(page.locator('[data-checklist-progress]')).toContainText('4/4');
    });

    test('typed or pasted items go straight into the task checklist', async ({ page }) => {
        await page.fill('#checklist-items', ['- [ ] Driver login', '• Go online', '', '☐ Accept ride', '1. Complete ride'].join('\n'));
        await page.click('form[data-action="add-items"] button[type="submit"]');
        await expect(page.locator('.alert-success')).toContainText('Added 4 items');
        // Appended after the four seeded items, in pasted order, with no checklist names shown.
        await expect(page.locator('.checklist-text')).toHaveText([
            'Create login page', 'Add validation', 'Forgot password', 'Email verification',
            'Driver login', 'Go online', 'Accept ride', 'Complete ride',
        ]);
        await expect(page.locator('.checklist-title')).toHaveCount(0);
        await expect(page.locator('[data-checklist-progress]')).toContainText('2/8');
    });

    test('edit an item and delete one', async ({ page }) => {
        page.on('dialog', (d) => d.accept());

        await page.getByRole('button', { name: 'Edit Forgot password' }).click();
        await page.locator('.checklist-edit input').fill('Reset password');
        await page.locator('.checklist-edit input').press('Enter');
        await expect(page.locator('.alert-success')).toContainText('Item updated');
        await expect(page.locator('.checklist-text', { hasText: 'Reset password' })).toBeVisible();

        await page.getByRole('button', { name: 'Delete Email verification' }).click();
        await expect(page.locator('.alert-success')).toContainText('Item deleted');
        await expect(page.locator('.checklist-text', { hasText: 'Email verification' })).toHaveCount(0);
        await expect(page.locator('[data-checklist-progress]')).toContainText('2/3');
    });

    test('a viewer gets no toggle controls at all', async ({ page }) => {
        await signIn(page, 'tester');
        await page.goto(TASK);
        await expect(page.locator('.checklist-item')).not.toHaveCount(0);
        expect(await page.locator('[data-toggle-item]').count()).toBe(0);
        expect(await page.locator('.checklist-tools').count()).toBe(0);
        expect(await page.locator('#checklist-items').count()).toBe(0);
    });
});

test.describe('Projects and tasks', () => {
    test.beforeEach(() => resetData());

    test('create a project, then a task in it', async ({ page }) => {
        await signIn(page, 'designer');
        await page.goto('/project-form.html');
        await page.fill('input[name="name"]', 'Brand Refresh');
        await page.click('button[type="submit"]');
        await expect(page.locator('h1')).toHaveText('Brand Refresh');
        await expect(page.locator('.alert-success')).toContainText('Project created');
        await expect(page.getByText('You are Owner')).toBeVisible();

        await page.getByRole('link', { name: 'New task' }).click();
        await page.fill('input[name="title"]', 'Pick a typeface');
        await page.getByLabel('designer').check();
        await page.click('button[type="submit"]');
        await expect(page.locator('h1')).toHaveText('Pick a typeface');
        await expect(page.locator('.activity-body').first()).toContainText('created the task Pick a typeface');
    });

    test('a comment notifies the task creator, and the actor sees their own comment', async ({ page }) => {
        await signIn(page, 'developer');
        await page.goto('/task.html?project=1&id=2'); // created by admin
        await page.fill('textarea[name="comment"]', 'Reset flow is next.');
        await page.click('button:has-text("Post comment")');
        await expect(page.locator('.activity-body', { hasText: 'Reset flow is next.' })).toBeVisible();

        await signIn(page, 'admin');
        await page.goto('/notifications.html');
        await expect(page.locator('.list-item.is-unread', { hasText: 'New comment on a task' })).toBeVisible();
    });

    test('suggested tags add in one click; custom tags get a colour automatically', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/project.html?id=1'); // already has Design, Frontend, Backend, Urgent
        await expect(page.getByRole('button', { name: 'Add tag Design', exact: true })).toHaveCount(0);

        await page.getByRole('button', { name: 'Add tag Bug', exact: true }).click();
        await expect(page.locator('.alert-success')).toContainText('Tag added');
        await expect(page.locator('.tag-list .tag', { hasText: 'Bug' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add tag Bug', exact: true })).toHaveCount(0);

        await page.fill('#tag-name', 'Investor Meet');
        expect(await page.inputValue('#tag-color')).not.toBe('#6b7280');
    });

    test('a non-member gets the not-found page', async ({ page }) => {
        await signIn(page, 'designer');
        await page.goto('/project.html?id=4'); // Internal Wiki
        await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
    });

    test('a signed-out visitor is sent to sign in, then back', async ({ page }) => {
        await page.goto('/board.html?project=1');
        await expect(page).toHaveURL(/login\.html\?next=/);
        await page.fill('input[name="email"]', 'admin@example.test');
        await page.fill('input[name="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/board\.html\?project=1$/);
    });
});

test.describe('Form validation', () => {
    test('an empty project form is stopped in the browser', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/project-form.html');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/project-form\.html$/);
        await expect(page.locator('.field.is-invalid')).toHaveCount(1);
        await expect(page.locator('.field-error').first()).toContainText('name');
    });

    test('the message clears once the field is valid', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/project-form.html');
        await page.click('button[type="submit"]');
        await expect(page.locator('.field.is-invalid')).toHaveCount(1);
        await page.fill('input[name="name"]', 'A Real Project Name');
        await expect(page.locator('.field.is-invalid')).toHaveCount(0);
    });
});

test.describe('Accessibility', () => {
    test('the skip link is the first tab stop and reveals itself on focus', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/dashboard.html');
        await expect(page.locator('h1')).toHaveText('Dashboard');
        const skip = page.locator('.skip-link');
        expect((await skip.boundingBox())?.y).toBeLessThan(0);
        await page.keyboard.press('Tab');
        await expect(skip).toBeFocused();
        // It slides in over a 120ms transition.
        await expect.poll(async () => (await skip.boundingBox())?.y).toBeGreaterThanOrEqual(0);
    });

    test('activating the skip link moves focus to the main region', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/dashboard.html');
        await expect(page.locator('h1')).toHaveText('Dashboard');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#main-content$/);
    });
});

test.describe('Typography and palette', () => {
    test('all three self-hosted fonts load from our own origin', async ({ page }) => {
        const fontRequests = [];
        page.on('request', (r) => {
            if (r.url().includes('/assets/fonts/')) fontRequests.push(r.url());
        });
        await signIn(page, 'admin');
        await page.goto('/activity.html?project=1');
        await expect(page.locator('h1')).toHaveText('Activity');
        expect(fontRequests.every((u) => u.startsWith('http://localhost:8123/'))).toBe(true);

        const loaded = await page.evaluate(async () => {
            await Promise.all([
                document.fonts.load('400 1em "Source Code Pro Web"'),
                document.fonts.load('700 1em "Iosevka Term Slab Web"'),
                document.fonts.load('400 1em "Terminess Web"'),
            ]);
            return {
                body: document.fonts.check('400 1em "Source Code Pro Web"'),
                display: document.fonts.check('700 1em "Iosevka Term Slab Web"'),
                mono: document.fonts.check('400 1em "Terminess Web"'),
                tick: document.fonts.check('400 1em "Source Code Pro Web"', '✓'),
                arrow: document.fonts.check('400 1em "Source Code Pro Web"', '→'),
            };
        });
        expect(loaded).toEqual({ body: true, display: true, mono: true, tick: true, arrow: true });
    });

    test('the accent is achromatic', async ({ page }) => {
        await signIn(page, 'admin');
        await page.goto('/project-form.html');
        const background = await page.locator('button[type="submit"]').evaluate((el) => getComputedStyle(el).backgroundColor);
        const [r, g, b] = background.match(/\d+/g).map(Number);
        expect(r).toBe(g);
        expect(g).toBe(b);
    });
});
