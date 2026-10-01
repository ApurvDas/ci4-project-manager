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
    execFileSync('docker', ['exec', '-i', 'supabase_db_project-manager', 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'], {
        input: sql,
        stdio: ['pipe', 'ignore', 'pipe'],
    });
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
