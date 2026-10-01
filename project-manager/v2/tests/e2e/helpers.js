import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const PASSWORD = 'Password123!';

const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8');

// Wipe and re-seed the local database in well under a second (a full
// `supabase db reset` restarts containers). Ids restart, so project 1 and
// task 2 are always the same seeded rows.
export function resetData() {
    runSql(`
        truncate auth.users cascade;
        truncate public.projects, public.activity_logs, public.notifications restart identity cascade;
        ${seed}`);
}

// Run SQL against the local database, for setting up a state the UI can't reach.
export function runSql(sql) {
    // A page left over from the previous test may still be syncing, and a truncate can lose a lock
    // race with it; try again rather than fail the test.
    for (let attempt = 1; ; attempt++) {
        try {
            execFileSync('docker', ['exec', '-i', 'supabase_db_project-manager', 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'], {
                input: sql,
                stdio: ['pipe', 'ignore', 'pipe'],
            });
            return;
        } catch (error) {
            if (attempt === 3) throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        }
    }
}

// Wait until live updates are really flowing to this page. The local live-update server occasionally
// drops an event just after a database reset, so prove the path with a harmless change first (touching
// a row announces it without altering anything you can see), and only then time the real one.
export async function liveReady(page) {
    let pulls = 0;
    page.on('request', (request) => { if (request.url().includes('sync_pull')) pulls++; });
    await page.waitForTimeout(600); // let the page's own start-up pulls finish
    for (let attempt = 0; attempt < 6; attempt++) {
        const before = pulls;
        runSql('update public.tasks set priority = priority where id = 1');
        try {
            await expect.poll(() => pulls, { timeout: 4000 }).toBeGreaterThan(before);
            return;
        } catch { /* not delivered: try again */ }
    }
    throw new Error('live updates never arrived at the page');
}

export async function signIn(page, username) {
    await page.goto('/login.html');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login.html');
    await page.fill('input[name="email"]', `${username.toLowerCase()}@example.test`);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.locator('.user-chip')).toContainText(username);
}
