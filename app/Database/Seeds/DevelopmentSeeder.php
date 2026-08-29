<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\CLI\CLI;
use CodeIgniter\Database\Seeder;
use RuntimeException;

/**
 * Entry point for the development data set:
 *
 *     php spark db:seed DevelopmentSeeder
 *
 * Clears the application tables and rebuilds them from scratch, so it is safe
 * to run repeatedly while building features. Shield's own tables are never
 * truncated; UserSeeder simply skips accounts that already exist.
 */
class DevelopmentSeeder extends Seeder
{
    /**
     * Truncated before seeding, in reverse dependency order.
     */
    private const TABLES = [
        'activity_logs',
        'notifications',
        'task_checklist_items',
        'task_checklists',
        'task_tags',
        'task_comments',
        'task_assignees',
        'tasks',
        'tags',
        'project_members',
        'projects',
    ];

    public function run(): void
    {
        if (ENVIRONMENT === 'production') {
            throw new RuntimeException('DevelopmentSeeder must never be run in production.');
        }

        $this->truncateApplicationTables();

        $this->call(UserSeeder::class);
        $this->call(ProjectSeeder::class);
        $this->call(TaskSeeder::class);
        $this->call(ActivitySeeder::class);

        $this->report();
    }

    private function truncateApplicationTables(): void
    {
        $this->db->disableForeignKeyChecks();

        foreach (self::TABLES as $table) {
            $this->db->table($table)->truncate();
        }

        $this->db->enableForeignKeyChecks();
    }

    private function report(): void
    {
        if (! is_cli()) {
            return;
        }

        CLI::write('Seeded development data:', 'green');

        foreach (['users', ...array_reverse(self::TABLES)] as $table) {
            CLI::write(sprintf('  %-22s %d', $table, $this->db->table($table)->countAllResults()));
        }

        CLI::write('');
        CLI::write('Sign in with any of: admin, manager, developer, designer, tester', 'yellow');
        CLI::write('Email is <username>@example.test, password is ' . UserSeeder::DEFAULT_PASSWORD, 'yellow');
    }
}
