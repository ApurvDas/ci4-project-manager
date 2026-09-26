<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProjectsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'owner_id'    => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            'name'        => ['type' => 'varchar', 'constraint' => 150],
            'description' => ['type' => 'text', 'null' => true],
            'status'      => [
                'type'       => 'enum',
                'constraint' => ['planning', 'active', 'on_hold', 'completed', 'archived'],
                'default'    => 'planning',
            ],
            'priority' => [
                'type'       => 'enum',
                'constraint' => ['low', 'medium', 'high', 'critical'],
                'default'    => 'medium',
            ],
            'start_date' => ['type' => 'date', 'null' => true],
            'due_date'   => ['type' => 'date', 'null' => true],
            'created_at' => ['type' => 'datetime', 'null' => true],
            'updated_at' => ['type' => 'datetime', 'null' => true],
            'deleted_at' => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('owner_id');
        $this->forge->addKey('status');
        $this->forge->addKey('due_date');

        // RESTRICT: a user who still owns projects must not be erasable. Ownership
        // has to be transferred first so the project is never orphaned.
        $this->forge->addForeignKey('owner_id', 'users', 'id', 'CASCADE', 'RESTRICT');

        $this->forge->createTable('projects', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('projects', true);
    }
}
