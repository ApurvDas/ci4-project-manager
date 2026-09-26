import { defineConfig, devices } from '@playwright/test';

// Needs the local Supabase stack running: `npx supabase start`.
const PORT = process.env.PORT || '8123';

export default defineConfig({
    testDir: './tests/e2e',
    retries: process.env.CI ? 2 : 1,
    workers: 1, // every test resets the shared database
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npx http-server web -p ${PORT} -c-1 -s`,
        url: `http://localhost:${PORT}/login.html`,
        reuseExistingServer: !process.env.CI,
    },
});
