// @ts-check
const { test, expect } = require('@playwright/test');
const { signIn, resetData } = require('./helpers');

/**
 * Browser behaviour the PHP suite cannot observe: the checklist's AJAX toggle,
 * inline form validation, the skip link, and whether the self-hosted fonts and
 * the palette actually arrive.
 */

test.describe('Checklist', () => {
  const TASK = '/projects/1/tasks/2';   // Build authentication, 4 items, 2 ticked

  test.beforeEach(async ({ page }) => {
    // Ticking items mutates the checklist, so reset before each.
    resetData();
    await signIn(page, 'admin');
    await page.goto(TASK);
  });

  test('ticking an item updates the progress badge without reloading', async ({ page }) => {
    const badge = page.locator('[data-checklist-progress]');
    await expect(badge).toContainText('2/4');

    // Prove no navigation happens: a value set on window would be lost by one.
    await page.evaluate(() => { window.__stillTheSameDocument = true; });

    const item = page.locator('.checklist-item', { hasText: 'Forgot password' });
    await item.locator('.checklist-box').click();

    await expect(badge).toContainText('3/4');
    await expect(item).toHaveClass(/is-done/);

    expect(await page.evaluate(() => window.__stillTheSameDocument)).toBe(true);
  });

  test('a tick survives a reload, so it reached the database', async ({ page }) => {
    await page.locator('.checklist-item', { hasText: 'Forgot password' })
      .locator('.checklist-box').click();
    await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');

    await page.reload();
    await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');
  });

  test('two ticks in a row work, so the CSRF token is refreshed', async ({ page }) => {
    await page.locator('.checklist-item', { hasText: 'Forgot password' })
      .locator('.checklist-box').click();
    await expect(page.locator('[data-checklist-progress]')).toContainText('3/4');

    await page.locator('.checklist-item', { hasText: 'Email verification' })
      .locator('.checklist-box').click();
    await expect(page.locator('[data-checklist-progress]')).toContainText('4/4');
  });

  test('a viewer gets no toggle controls at all', async ({ page }) => {
    await signIn(page, 'tester');
    await page.goto(TASK);

    await expect(page.locator('.checklist-item')).not.toHaveCount(0);
    expect(await page.locator('form[data-toggle-item]').count()).toBe(0);
  });
});

test.describe('Form validation', () => {
  test('an empty project form is stopped in the browser', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/projects/new');

    await page.click('button[type="submit"]');

    // Still on the form, with an inline message rather than a round trip.
    await expect(page).toHaveURL(/\/projects\/new/);
    await expect(page.locator('.field.is-invalid')).toHaveCount(1);
    await expect(page.locator('.field-error').first()).toContainText('name');
  });

  test('the message clears once the field is valid', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/projects/new');

    await page.click('button[type="submit"]');
    await expect(page.locator('.field.is-invalid')).toHaveCount(1);

    await page.fill('input[name="name"]', 'A Real Project Name');
    await expect(page.locator('.field.is-invalid')).toHaveCount(0);
  });
});

test.describe('Accessibility', () => {
  test('the skip link is the first tab stop and reveals itself on focus', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard');

    const skip = page.locator('.skip-link');

    // Off-screen until focused.
    expect((await skip.boundingBox())?.y).toBeLessThan(0);

    await page.keyboard.press('Tab');

    await expect(skip).toBeFocused();
    // Now on-screen: this is the assertion I could never make by hand, because
    // the headless pane has no OS focus and :focus never matched there.
    expect((await skip.boundingBox())?.y).toBeGreaterThanOrEqual(0);
  });

  test('activating the skip link moves focus to the main region', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard');

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
    await page.goto('/projects/1/activity');   // uses all three roles
    await page.waitForLoadState('networkidle');

    // Nothing from a third party.
    expect(fontRequests.every((u) => u.startsWith('http://localhost:8123/'))).toBe(true);

    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('400 1em "Source Code Pro Web"'),
        document.fonts.load('700 1em "Iosevka Term Slab Web"'),
        document.fonts.load('400 1em "Terminess Web"'),
      ]);
      return {
        body: document.fonts.check('400 1em "Source Code Pro Web"'),
        display: document.fonts.check('700 1em "Iosevka Term Slab Web"'),
        mono: document.fonts.check('400 1em "Terminess Web"'),
        // The glyphs the interface actually renders must survive subsetting.
        tick: document.fonts.check('400 1em "Source Code Pro Web"', '✓'),
        arrow: document.fonts.check('400 1em "Source Code Pro Web"', '→'),
      };
    });

    expect(loaded).toEqual({
      body: true, display: true, mono: true, tick: true, arrow: true,
    });
  });

  test('the accent is achromatic', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/projects/new');

    const background = await page
      .locator('button[type="submit"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    // Black in light mode: red, green and blue all equal.
    const [r, g, b] = background.match(/\d+/g).map(Number);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});
