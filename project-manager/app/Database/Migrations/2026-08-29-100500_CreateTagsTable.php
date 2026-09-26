<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTagsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'project_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'name'       => ['type' => 'varchar', 'constraint' => 50],
            // Hex colour used by the UI badge, e.g. #4F46E5.
            'color'      => ['type' => 'varchar', 'constraint' => 7, 'default' => '#6B7280'],
            'created_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Tag names are unique per project; also indexes project_id.
        $this->forge->addUniqueKey(['project_id', 'name']);

        $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('tags', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('tags', true);
    }
}
