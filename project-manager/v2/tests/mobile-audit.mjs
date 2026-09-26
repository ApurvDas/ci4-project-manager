// Phone-width audit: opens every page at 390px, reports horizontal overflow
// (and which elements cause it), and saves full-page screenshots.
// Usage: node tests/mobile-audit.mjs [outDir]   (local stack + npm run serve)
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:8123/';
const OUT = process.argv[2] ?? 'test-results/mobile';
const PAGES = ['login.html', 'register.html', 'dashboard.html', 'projects.html', 'project.html?id=1', 'project-form.html',
    'board.html?project=1', 'tasks.html?project=1', 'task.html?project=1&id=2', 'task-form.html?project=1&id=2',
    'activity.html?project=1', 'notifications.html'];

const browser = await chromium.launch();
const W = Number(process.env.W ?? 390);
const context = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: W > 800 ? 1 : 2, isMobile: W < 800, hasTouch: W < 800, colorScheme: process.env.SCHEME ?? 'light' });
const page = await context.newPage();

await page.goto(BASE + 'login.html');
await page.screenshot({ path: `${OUT}/login-signed-out.png` });
await page.fill('#email', `${process.env.AS ?? 'admin'}@example.test`);
await page.fill('#password', 'Password123!');
await page.click('button[type=submit]');
await page.waitForSelector('.user-chip');

for (const path of PAGES) {
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle');
    const report = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const culprits = [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().right > width + 1 && !el.closest('.board'))
            .filter((el, _, all) => !all.some((other) => other !== el && other.contains(el)))
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (right ${Math.round(el.getBoundingClientRect().right)})`);
        return { overflow: document.documentElement.scrollWidth - width, culprits };
    });
    console.log(`${path.padEnd(32)} overflow ${report.overflow}px ${report.culprits.join(' | ')}`);
    await page.screenshot({ path: `${OUT}/${path.replace(/[?=&]/g, '_')}.png`, fullPage: true });
}
await browser.close();
