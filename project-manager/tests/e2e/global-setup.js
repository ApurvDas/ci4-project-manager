// @ts-check
const { execFileSync } = require('node:child_process');

/**
 * Reset the development database before the run.
 *
 * These tests drive the real application against the real development
 * database, and some of them move cards and tick checklist items. Re-seeding
 * first means a run always starts from the same known data, and a failed run
 * cannot poison the next one.
 */
module.exports = async () => {
  process.stdout.write('Seeding the development database... ');

  try {
    execFileSync('php', ['spark', 'db:seed', 'DevelopmentSeeder'], {
      cwd: __dirname + '/../..',
      stdio: 'pipe',
    });

    process.stdout.write('done\n');
  } catch (error) {
    // Fail loudly: tests that assert on seeded rows are meaningless without it.
    process.stdout.write('FAILED\n');
    throw new Error(
      'Could not seed the database, so the expected fixtures are not present.\n' +
      'Check that MySQL is running.\n\n' +
      String(error.stdout || error.message),
    );
  }
};
