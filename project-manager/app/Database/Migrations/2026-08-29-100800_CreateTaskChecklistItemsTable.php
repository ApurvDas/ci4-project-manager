<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTaskChecklistItemsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'           => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'checklist_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'content'      => ['type' => 'varchar', 'constraint' => 255],
            'is_completed' => ['type' => 'tinyint', 'constraint' => 1, 'default' => 0],
            'position'     => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'default' => 0],
            'created_at'   => ['type' => 'datetime', 'null' => true],
            'updated_at'   => ['type' => 'datetime', 'null' => true],
            'completed_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Items are always read as an ordered list for one checklist.
        $this->forge->addKey(['checklist_id', 'position']);

        $this->forge->addForeignKey('checklist_id', 'task_checklists', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('task_checklist_items', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('task_checklist_items', true);
    }
}
