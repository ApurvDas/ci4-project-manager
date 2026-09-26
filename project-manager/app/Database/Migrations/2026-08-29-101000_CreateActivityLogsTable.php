<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateActivityLogsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            // Both owners are nullable so the audit trail outlives them (see the
            // SET NULL foreign keys below).
            'user_id'    => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            'project_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            // Polymorphic subject, e.g. entity_type = task, entity_id = 42.
            'entity_type' => ['type' => 'varchar', 'constraint' => 50],
            'entity_id'   => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            // e.g. create, update, delete, assign, complete
            'action'      => ['type' => 'varchar', 'constraint' => 50],
            'description' => ['type' => 'varchar', 'constraint' => 255, 'null' => true],
            'old_values'  => ['type' => 'json', 'null' => true],
            'new_values'  => ['type' => 'json', 'null' => true],
            'created_at'  => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Project activity feed, newest first.
        $this->forge->addKey(['project_id', 'created_at']);
        // "History of this task / this project record".
        $this->forge->addKey(['entity_type', 'entity_id']);
        $this->forge->addKey('user_id');

        // SET NULL rather than CASCADE on both sides: an audit trail must survive
        // the deletion of the actor or the project it describes. The log keeps its
        // description, entity pointer and value diff even once the FK is cleared.
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'SET NULL');
        $this->forge->addForeignKey('project_id', 'projects', 'id', 'CASCADE', 'SET NULL');

        $this->forge->createTable('activity_logs', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('activity_logs', true);
    }
}
