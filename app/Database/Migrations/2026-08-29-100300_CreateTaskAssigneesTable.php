<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTaskAssigneesTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'task_id'     => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'user_id'     => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'assigned_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // A user may only be assigned to a given task once.
        $this->forge->addUniqueKey(['task_id', 'user_id']);
        // Drives "tasks assigned to me" on the dashboard.
        $this->forge->addKey('user_id');

        $this->forge->addForeignKey('task_id', 'tasks', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('task_assignees', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('task_assignees', true);
    }
}
