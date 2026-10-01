import { test, expect } from '@playwright/test';

// The floating clock must be nearly free when the page is idle. The login page
// shows it and needs no database, so this runs without the Supabase stack.
test('an idle page with the clock does almost no main-thread work', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.clock')).toHaveCount(1);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const taskDuration = async () => (await cdp.send('Performance.getMetrics'))
        .metrics.find((m) => m.name === 'TaskDuration').value;

    const before = await taskDuration();
    await page.waitForTimeout(10_000);
    const busy = (await taskDuration()) - before;
    console.log(`idle main-thread time over 10s: ${(busy * 1000).toFixed(0)} ms`);

    // The old requestAnimationFrame loop measured ~320 ms here; the budget is 80% less.
    expect(busy * 1000).toBeLessThan(64);
});
