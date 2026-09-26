<?php

declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateNotificationsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'      => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'user_id' => ['type' => 'int', 'constraint' => 11, 'unsigned' => true],
            // e.g. task_assigned, project_invitation, comment_added
            'type'    => ['type' => 'varchar', 'constraint' => 50],
            'title'   => ['type' => 'varchar', 'constraint' => 150],
            'message' => ['type' => 'varchar', 'constraint' => 255, 'null' => true],
            // Polymorphic pointer to the subject of the notification.
            'related_type' => ['type' => 'varchar', 'constraint' => 50, 'null' => true],
            'related_id'   => ['type' => 'int', 'constraint' => 11, 'unsigned' => true, 'null' => true],
            'read_at'      => ['type' => 'datetime', 'null' => true],
            'created_at'   => ['type' => 'datetime', 'null' => true],
        ]);

        $this->forge->addPrimaryKey('id');
        // Every read is scoped to one user, usually filtered by unread; a single
        // composite serves both that and the user_id foreign key.
        $this->forge->addKey(['user_id', 'read_at']);

        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('notifications', false, ['ENGINE' => 'InnoDB']);
    }

    public function down(): void
    {
        $this->forge->dropTable('notifications', true);
    }
}
