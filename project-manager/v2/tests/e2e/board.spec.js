import { test, expect } from '@playwright/test';
import { signIn, resetData } from './helpers.js';

const BOARD = '/board.html?project=1'; // Website Redesign

// The board renders after its data loads (e.g. after a reload), and
// allInnerTexts() doesn't wait, so wait for the columns first.
async function columnTitles(page, status) {
    await expect(page.locator('.board-column')).toHaveCount(4);
    const titles = await page.locator(`[data-status="${status}"] .board-card-title`).allInnerTexts();
    return titles.map((t) => t.trim());
}

async function dragCardTo(page, title, status) {
    const card = page.locator('.board-card', { hasText: title }).first();
    await card.dragTo(page.locator(`[data-status="${status}"] [data-dropzone]`));
    await expect(page.locator('[data-board-status]')).toHaveText(/Saved\./);
}

test.describe('Kanban board', () => {
    test.beforeEach(async ({ page }) => {
        resetData();
        await signIn(page, 'admin');
        await page.goto(BOARD);
    });

    test('renders every column with its seeded cards', async ({ page }) => {
        await expect(page.locator('.board-column')).toHaveCount(4);
        expect(await columnTitles(page, 'todo')).toEqual(['Migrate legacy content', 'Deploy application']);
        expect(await columnTitles(page, 'in_progress')).toEqual(['Build authentication', 'Create API']);
    });

    test('dragging a card to another column moves it and persists', async ({ page }) => {
        await dragCardTo(page, 'Deploy application', 'review');
        expect(await columnTitles(page, 'review')).toContain('Deploy application');
        expect(await columnTitles(page, 'todo')).not.toContain('Deploy application');
        await page.reload();
        expect(await columnTitles(page, 'review')).toContain('Deploy application');
    });

    test('column counts follow the cards', async ({ page }) => {
        const todoCount = page.locator('[data-status="todo"] [data-column-count]');
        const reviewCount = page.locator('[data-status="review"] [data-column-count]');
        await expect(todoCount).toHaveText('2');
        await expect(reviewCount).toHaveText('1');
        await dragCardTo(page, 'Deploy application', 'review');
        await expect(todoCount).toHaveText('1');
        await expect(reviewCount).toHaveText('2');
    });

    test('two drags in a row both persist', async ({ page }) => {
        await dragCardTo(page, 'Deploy application', 'review');
        await dragCardTo(page, 'Migrate legacy content', 'completed');
        await page.reload();
        expect(await columnTitles(page, 'review')).toContain('Deploy application');
        expect(await columnTitles(page, 'completed')).toContain('Migrate legacy content');
    });

    test('a viewer is told the board is read-only and cards are not draggable', async ({ page }) => {
        await signIn(page, 'tester'); // viewer on Website Redesign
        await page.goto(BOARD);
        await expect(page.getByText('read-only access')).toBeVisible();
        expect(await page.locator('.board-card[draggable="true"]').count()).toBe(0);
    });
});
