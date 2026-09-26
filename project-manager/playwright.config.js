// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Configurable because PHP's built-in server on this machine wedges on a port
// that has been bound and killed repeatedly. If a run hangs, retry on a fresh
// one: PORT=8140 npm run e2e.
const PORT = process.env.PORT || '8123';

/**
 * End-to-end tests.
 *
 * These exist to cover what the PHPUnit suite cannot reach. PHPUnit drives the
 * framework directly: it never runs JavaScript, so the Kanban drag-and-drop,
 * the checklist's AJAX toggle, the inline form validation and the skip link's
 * reveal-on-focus were all previously verified by hand or not at all.
 *
 * They run against the development database, so globalSetup re-seeds first and
 * every run starts from the same known data.
 */
module.exports = defineConfig({
  testDir: './tests/e2e',

  // The seeded data is fixed, so a flake here means a real race, not a fixture
  // clash. Retry once locally to surface that rather than hide it, and twice in
  // CI where machines are slower.
  retries: process.env.CI ? 2 : 1,

  // The dev server is PHP's built-in one, which handles a single request at a
  // time. Parallel workers would queue behind each other and time out, so this
  // stays serial no matter how many cores are available.
  workers: 1,
  fullyParallel: false,

  // Fail the run rather than silently pass if someone commits a .only.
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  globalSetup: require.resolve('./tests/e2e/global-setup'),

  use: {
    baseURL: `http://localhost:${PORT}`,

    // Artefacts only for failures: a trace of every passing test is noise, but
    // a trace of the one that failed is the whole debugging session.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Not `php spark serve`: CodeIgniter builds that command with
    // escapeshellarg(), whose quoting Windows cmd does not understand, so the
    // server accepts connections and never answers. This is the equivalent.
    // Port 8123 rather than 8080 because a server bound to 8080 on this machine
    // hangs reproducibly — see docs/deployment.md.
    // dev-router.php is CodeIgniter's rewrite plus a far-future cache header
    // for /assets/, so repeat navigation does not re-fetch the fonts.
    command: `php -S localhost:${PORT} -t public public/dev-router.php`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
