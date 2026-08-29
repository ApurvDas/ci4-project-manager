<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTaskChecklistsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'task_id'    => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'title'      => ['type' => 'varchar', 'constraint' => 150],
            'created_at' => ['type' => 'datetime', 'null' => true],
            'updated_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('task_id');

        $this->forge->addForeignKey('task_id', 'tasks', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('task_checklists', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('task_checklists', true);
    }
}
