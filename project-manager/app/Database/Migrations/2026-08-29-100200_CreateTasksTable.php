<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTasksTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'project_id'  => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'created_by'  => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'title'       => ['type' => 'varchar', 'constraint' => 200],
            'description' => ['type' => 'text', 'null' => true],
            'status'      => [
                'type'       => 'enum',
                'constraint' => ['todo', 'in_progress', 'review', 'completed'],
                'default'    => 'todo',
            ],
            'priority' => [
                'type'       => 'enum',
                'constraint' => ['low', 'medium', 'high', 'critical'],
                'default'    => 'medium',
            ],
            // Ordering within a Kanban column.
            'position'     => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'default' => 0],
            'start_date'   => ['type' => 'date', 'null' => true],
            'due_date'     => ['type' => 'date', 'null' => true],
            'completed_at' => ['type' => 'datetime', 'null' => true],
            'created_at'   => ['type' => 'datetime', 'null' => true],
            'updated_at'   => ['type' => 'datetime', 'null' => true],
            'deleted_at'   => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Drives the Kanban board query; also covers project_id on its own.
        $this->forge->addKey(['project_id', 'status', 'position']);
        $this->forge->addKey('created_by');
        $this->forge->addKey('status');
        $this->forge->addKey('due_date');

        $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE', 'CASCADE');
        // RESTRICT: keep task authorship intact; the user must be reassigned first.
        $this->forge->addForeignKey('created_by', 'users', 'id', 'CASCADE', 'RESTRICT');

        $this->forge->createTable('tasks', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('tasks', true);
    }
}
