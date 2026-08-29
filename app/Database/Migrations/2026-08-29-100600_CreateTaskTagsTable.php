<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTaskTagsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'task_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'tag_id'  => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
        ]);

        // Pure join table: the pair is the identity, so no surrogate key.
        $this->forge->addPrimaryKey(['task_id', 'tag_id']);
        // Reverse lookup ("which tasks carry this tag") and the tag_id FK index.
        $this->forge->addKey('tag_id');

        $this->forge->addForeignKey('task_id', 'tasks', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('tag_id', 'tags', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('task_tags', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('task_tags', true);
    }
}
