// Viewport sweep: many widths and aspect ratios, reporting horizontal overflow,
// whether every header control is on screen, and whether the clock is fully visible.
// Usage: node tests/viewport-sweep.mjs [outDir]   (local stack + npm run serve)
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:8123/';
const OUT = process.argv[2];
const SIZES = [[320, 568], [360, 740], [390, 844], [430, 932], [568, 320], [540, 720], [620, 800], [680, 900], [779, 852],
    [844, 390], [900, 700], [1024, 768], [1180, 820], [768, 1024, 'tablet'], [820, 1180, 'tablet'], [1024, 1366, 'tablet'], [1180, 820, 'tablet'], [1280, 800], [1440, 900], [1920, 1080]];
const PAGES = ['dashboard.html', 'project.html?id=1', 'task.html?project=1&id=2', 'analytics.html?project=1', 'search.html?q=auth'];

const browser = await chromium.launch();
let failures = 0;
for (const [w, h, kind] of SIZES) {
    const phone = kind === 'tablet' || Math.min(w, h) < 500;
    const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, colorScheme: process.env.SCHEME ?? 'dark' });
    const page = await context.newPage();
    await page.goto(BASE + 'login.html');
    await page.fill('#email', `${process.env.AS ?? 'ironwarrior'}@example.test`);
    await page.fill('#password', 'Password123!');
    await page.click('button[type=submit]');
    await page.waitForSelector('.user-chip');
    for (const path of PAGES) {
        await page.goto(BASE + path);
        await page.waitForLoadState('networkidle');
        const r = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const vh = window.innerHeight;
            const out = (el) => { const b = el.getBoundingClientRect(); return b.left < -1 || b.right > vw + 1; };
            const header = [...document.querySelectorAll('.app-header a, .app-header button, .app-header label')].filter(out)
                .map((el) => (el.textContent.trim() || el.getAttribute('aria-label') || el.className).slice(0, 20));
            const c = document.querySelector('.clock')?.getBoundingClientRect();
            const clock = c && c.left >= 0 && c.top >= 0 && c.right <= vw && c.bottom <= vh && c.width > 40;
            return { overflow: document.documentElement.scrollWidth - vw, header, clock, rows: Math.round(document.querySelector('.app-header').offsetHeight) };
        });
        const bad = r.overflow > 0 || r.header.length || !r.clock;
        failures += bad;
        console.log(`${bad ? 'FAIL' : 'ok  '} ${`${w}x${h}${kind ? ' ' + kind : ''}`.padEnd(18)} ${path.padEnd(28)} overflow ${r.overflow}px header ${r.rows}px clock ${r.clock ? 'visible' : 'HIDDEN'} ${r.header.length ? 'off-screen: ' + r.header.join(', ') : ''}`);
        if (OUT && path === 'project.html?id=1') await page.screenshot({ path: `${OUT}/${w}x${h}${kind ?? ''}.png` });
    }
    await context.close();
}
await browser.close();
console.log(failures ? `${failures} failing` : 'all ok');
process.exit(failures ? 1 : 0);
