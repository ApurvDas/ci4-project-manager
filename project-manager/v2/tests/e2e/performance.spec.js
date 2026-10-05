import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

// The old cache-header tests are gone: GitHub Pages sets its own headers.
test('the above-the-fold fonts are preloaded with crossorigin', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/dashboard.html');
    const links = page.locator('link[rel="preload"][as="font"]');
    expect(await links.evaluateAll((all) => all.map((l) => new URL(l.href).pathname))).toEqual([
        '/assets/fonts/google-sans-code-400.woff2',
        '/assets/fonts/google-sans-code-600.woff2',
        '/assets/fonts/geist-mono-700.woff2',
    ]);
    expect(await links.evaluateAll((all) => all.every((l) => l.hasAttribute('crossorigin')))).toBe(true);
});
