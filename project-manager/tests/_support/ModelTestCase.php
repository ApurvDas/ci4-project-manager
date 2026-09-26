<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Database\Seeds\DevelopmentSeeder;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

/**
 * Base class for the application model tests.
 *
 * Runs against the dedicated `tests` database group (project_manager_test),
 * never the development database. The schema is migrated once for the whole
 * suite, and DevelopmentSeeder re-seeds before every test, so each test starts
 * from the same known data set regardless of what its neighbours did.
 */
abstract class ModelTestCase extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $DBGroup = 'tests';

    /**
     * null means "every namespace", so Shield's auth tables are built too.
     */
    protected $namespace;

    protected $refresh     = true;
    protected $migrateOnce = true;
    protected $seed        = DevelopmentSeeder::class;
    protected $seedOnce    = false;

    /**
     * Resolve a seeded user's id by username.
     */
    protected function userId(string $username): int
    {
        return (int) $this->db->table('users')
            ->select('id')
            ->where('username', $username)
            ->get()
            ->getRowArray()['id'];
    }

    /**
     * Resolve a seeded project's id by name.
     */
    protected function projectId(string $name): int
    {
        return (int) $this->db->table('projects')
            ->select('id')
            ->where('name', $name)
            ->get()
            ->getRowArray()['id'];
    }

    /**
     * Resolve a seeded task's id by title.
     */
    protected function taskId(string $title): int
    {
        return (int) $this->db->table('tasks')
            ->select('id')
            ->where('title', $title)
            ->get()
            ->getRowArray()['id'];
    }
}
