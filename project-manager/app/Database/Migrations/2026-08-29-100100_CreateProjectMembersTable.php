<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProjectMembersTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'project_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'user_id'    => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'role'       => [
                'type'       => 'enum',
                'constraint' => ['owner', 'manager', 'member', 'viewer'],
                'default'    => 'member',
            ],
            'joined_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Also serves as the lookup index for project_id (leftmost prefix).
        $this->forge->addUniqueKey(['project_id', 'user_id']);
        $this->forge->addKey('user_id');

        // Membership is meaningless once either side is gone.
        $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('project_members', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('project_members', true);
    }
}
