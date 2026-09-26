// @ts-check
const { test, expect } = require('@playwright/test');
const { signIn, resetData } = require('./helpers');

/**
 * The Kanban board's drag and drop.
 *
 * This is the reason these tests exist. PHPUnit can post to the move endpoint,
 * but it cannot drag a card, so until now the actual browser behaviour — the
 * HTML5 drag events, the optimistic DOM move, the fetch that follows and the
 * CSRF token rotating between drags — had only ever been checked by hand.
 *
 * Seeded Website Redesign board:
 *   Todo         Migrate legacy content, Deploy application
 *   In progress  Build authentication, Create API
 *   Review       Accessibility audit
 *   Completed    Design homepage
 */

const BOARD = '/projects/1/board';

/** Titles currently in a column, top to bottom. */
async function columnTitles(page, status) {
  return page
    .locator(`[data-status="${status}"] .board-card-title`)
    .allInnerTexts()
    .then((titles) => titles.map((t) => t.trim()));
}

/**
 * Drag one card onto a column.
 *
 * Playwright's dragTo dispatches real pointer events, so this exercises the
 * dragstart/dragover/drop handlers rather than calling the endpoint directly.
 */
async function dragCardTo(page, title, status) {
  const card = page.locator('.board-card', { hasText: title }).first();
  const target = page.locator(`[data-status="${status}"] [data-dropzone]`);

  await card.dragTo(target);

  // The move is persisted by a fetch; wait for the board to report it rather
  // than sleeping a fixed amount.
  await expect(page.locator('[data-board-status]')).toHaveText(/Saved\./);
}

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    // Every test here drags a card, so each one starts from the seeded board.
    resetData();
    await signIn(page, 'admin');
    await page.goto(BOARD);
  });

  test('renders every column with its seeded cards', async ({ page }) => {
    await expect(page.locator('.board-column')).toHaveCount(4);

    expect(await columnTitles(page, 'todo')).toEqual([
      'Migrate legacy content',
      'Deploy application',
    ]);
    expect(await columnTitles(page, 'in_progress')).toEqual([
      'Build authentication',
      'Create API',
    ]);
  });

  test('dragging a card to another column moves it and persists', async ({ page }) => {
    await dragCardTo(page, 'Deploy application', 'review');

    // Present in the new column, gone from the old one.
    expect(await columnTitles(page, 'review')).toContain('Deploy application');
    expect(await columnTitles(page, 'todo')).not.toContain('Deploy application');

    // The real proof: it survives a reload, so the server agreed.
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

  test('a second drag still works, so the CSRF token really is rotating', async ({ page }) => {
    // The token changes on every request. If the board did not pick the new one
    // out of the JSON response, this second drag would be rejected — which is
    // exactly the bug this guards against.
    await dragCardTo(page, 'Deploy application', 'review');
    await dragCardTo(page, 'Migrate legacy content', 'completed');

    await page.reload();
    expect(await columnTitles(page, 'review')).toContain('Deploy application');
    expect(await columnTitles(page, 'completed')).toContain('Migrate legacy content');
  });

  test('a viewer is told the board is read-only and cards are not draggable', async ({ page }) => {
    await signIn(page, 'tester');           // viewer on Website Redesign
    await page.goto(BOARD);

    await expect(page.getByText('read-only access')).toBeVisible();

    // Not merely hidden controls: the cards carry no draggable attribute, and
    // the server would refuse the move regardless.
    const draggable = await page.locator('.board-card[draggable="true"]').count();
    expect(draggable).toBe(0);
  });
});
