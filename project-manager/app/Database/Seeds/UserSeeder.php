<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;

/**
 * Development users.
 *
 * Accounts are created through Shield's UserModel rather than the query builder
 * so that passwords are hashed and the matching auth_identities row is written
 * by Shield itself. Re-running the seeder leaves existing accounts alone.
 */
class UserSeeder extends Seeder
{
    /**
     * Shared password for every seeded account. Development only.
     */
    public const DEFAULT_PASSWORD = 'Password123!';

    private const USERS = [
        ['username' => 'admin',     'email' => 'admin@example.test',     'group' => 'admin'],
        ['username' => 'manager',   'email' => 'manager@example.test',   'group' => 'developer'],
        ['username' => 'developer', 'email' => 'developer@example.test', 'group' => 'developer'],
        ['username' => 'designer',  'email' => 'designer@example.test',  'group' => 'user'],
        ['username' => 'tester',    'email' => 'tester@example.test',    'group' => 'user'],
    ];

    public function run(): void
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);

        foreach (self::USERS as $row) {
            if ($users->findByCredentials(['email' => $row['email']]) !== null) {
                continue;
            }

            $user = new User([
                'username' => $row['username'],
                'email'    => $row['email'],
                'password' => self::DEFAULT_PASSWORD,
                'active'   => 1,
            ]);

            $users->save($user);

            $user = $users->findById($users->getInsertID());
            $user->addGroup($row['group']);
        }
    }
}
