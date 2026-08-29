// @ts-check
const { test, expect } = require('@playwright/test');
const { signIn } = require('./helpers');

/**
 * Load-performance guarantees.
 *
 * The application is served by a single-threaded development server, so the
 * cost of a page is dominated by how many requests it makes in series, not by
 * server render time. These lock in the two things that keep that low: the
 * above-the-fold fonts are preloaded, and static assets are cached hard so
 * repeat navigation does not re-fetch them.
 */

test.describe('Loading performance', () => {
  test('the above-the-fold fonts are preloaded', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard');

    const preloaded = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll((links) => links.map((l) => new URL(l.href).pathname));

    // The three faces that render visible text before the user scrolls.
    expect(preloaded).toEqual([
      '/assets/fonts/source-code-pro-400.woff2',
      '/assets/fonts/source-code-pro-600.woff2',
      '/assets/fonts/iosevka-term-slab-700.woff2',
    ]);

    // Every preload must be crossorigin, or the browser fetches the font twice.
    const crossorigin = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll((links) => links.every((l) => l.hasAttribute('crossorigin')));
    expect(crossorigin).toBe(true);
  });

  test('static assets are cached hard, so they are fetched at most once', async ({ page }) => {
    await signIn(page, 'admin');

    const cacheHeaders = new Map();
    page.on('response', (r) => {
      const url = new URL(r.url()).pathname;
      if (url.startsWith('/assets/')) {
        cacheHeaders.set(url, r.headers()['cache-control'] || '');
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    expect(cacheHeaders.size).toBeGreaterThan(0);
    for (const [url, header] of cacheHeaders) {
      expect(header, `${url} must be cacheable`).toContain('max-age=31536000');
      expect(header, `${url} must be immutable`).toContain('immutable');
    }
  });

  test('navigating between pages does not re-request the stylesheet', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Count stylesheet fetches that actually hit the network on a second
    // navigation. A hard-cached asset is served from memory and fires no
    // request at all.
    const cssFetches = [];
    page.on('request', (r) => {
      if (r.url().includes('/assets/css/app.css')) cssFetches.push(r.url());
    });

    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    expect(cssFetches.length).toBe(0);
  });
});
