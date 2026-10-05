import { test, expect } from '@playwright/test';
import { signIn, resetData, runSql } from './helpers.js';

// Two unread notifications for admin, both about task 2 in project 1.
const twoUnread = () => runSql(`
    insert into public.notifications (user_id, type, title, message, related_type, related_id, project_id)
    select id, 'comment_added', 'Older comment', 'Build authentication', 'task', 2, 1 from public.profiles where username = 'admin';
    insert into public.notifications (user_id, type, title, message, related_type, related_id, project_id)
    select id, 'comment_added', 'Newer comment', 'Build authentication', 'task', 2, 1 from public.profiles where username = 'admin';`);

const readButton = (page, title) => page.locator('.list-item', { hasText: title }).locator('form[data-read] button');

test.beforeEach(() => {
    resetData();
    twoUnread();
});

test('Mark as read takes its button away at once, without waiting for the server', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/notifications.html');
    await expect(readButton(page, 'Newer comment')).toBeVisible();

    // Hold the server's answer back: the button must still go the moment it is pressed.
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/rest/v1/notifications**', async (route) => {
        if (route.request().method() === 'PATCH') await held;
        await route.continue();
    });
    await readButton(page, 'Newer comment').click();
    await expect(readButton(page, 'Newer comment')).toBeHidden({ timeout: 100 });
    await expect(readButton(page, 'Older comment')).toBeVisible();

    release();
    await expect(page.locator('.alert-success')).toContainText('Notification marked as read.');
    await page.reload();
    await expect(readButton(page, 'Newer comment')).toHaveCount(0);
    await expect(readButton(page, 'Older comment')).toBeVisible();
    await expect(page.getByText('1 unread')).toBeVisible();
});

test('opening an unread notification marks it read', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/notifications.html');
    await page.getByRole('link', { name: 'Older comment' }).click();
    await expect(page).toHaveURL(/task\.html\?project=1&id=2/);

    await page.goto('/notifications.html');
    await expect(readButton(page, 'Older comment')).toHaveCount(0);
    await expect(readButton(page, 'Newer comment')).toBeVisible();
    await expect(page.getByText('1 unread')).toBeVisible();
});
