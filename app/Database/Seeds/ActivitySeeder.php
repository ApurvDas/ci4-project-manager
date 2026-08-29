<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\I18n\Time;

/**
 * Development notifications and activity log entries.
 *
 * A deliberate mix of read and unread notifications so the unread badge and the
 * dashboard counters have something to show, plus a short activity history for
 * each project including a status change with a value diff.
 */
class ActivitySeeder extends Seeder
{
    use ResolvesSeedIds;

    /**
     * [recipient, type, title, message, related task title, day offset, read]
     */
    private const NOTIFICATIONS = [
        ['developer', 'task_assigned', 'You were assigned a task', 'Build authentication in Website Redesign', -10, false],
        ['tester', 'task_assigned', 'You were assigned a task', 'Build authentication in Website Redesign', -10, false],
        ['developer', 'task_due_soon', 'A task is due soon', 'Build authentication is due in 2 days', -1, false],
        ['manager', 'task_status_changed', 'A task moved to review', 'Draft launch blog post is ready for review', -5, false],
        ['admin', 'comment_added', 'New comment on a task', 'designer commented on Draft launch blog post', -5, true],
        ['designer', 'task_assigned', 'You were assigned a task', 'Design homepage in Website Redesign', -20, true],
        ['tester', 'comment_added', 'New comment on a task', 'Your audit findings were acknowledged', -1, true],
    ];

    public function run(): void
    {
        $users      = $this->userIds();
        $projectIds = $this->projectIds();
        $taskIds    = $this->taskIds();
        $now        = Time::now();

        $notifications = [];

        foreach (self::NOTIFICATIONS as [$recipient, $type, $title, $message, $offset, $isRead]) {
            $createdAt = $now->addDays($offset)->toDateTimeString();

            $notifications[] = [
                'user_id'      => $users[$recipient],
                'type'         => $type,
                'title'        => $title,
                'message'      => $message,
                'related_type' => 'task',
                'related_id'   => $taskIds['Build authentication'],
                'read_at'      => $isRead ? $now->addDays($offset)->addHours(2)->toDateTimeString() : null,
                'created_at'   => $createdAt,
            ];
        }

        $this->db->table('notifications')->insertBatch($notifications);

        $this->db->table('activity_logs')->insertBatch([
            [
                'user_id'     => $users['admin'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'project',
                'entity_id'   => $projectIds['Website Redesign'],
                'action'      => 'create',
                'description' => 'admin created the project Website Redesign',
                'old_values'  => null,
                'new_values'  => json_encode(['name' => 'Website Redesign', 'status' => 'planning'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(30)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['admin'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'project',
                'entity_id'   => $projectIds['Website Redesign'],
                'action'      => 'update',
                'description' => 'admin moved the project into active',
                'old_values'  => json_encode(['status' => 'planning'], JSON_THROW_ON_ERROR),
                'new_values'  => json_encode(['status' => 'active'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(28)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['admin'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'member',
                'entity_id'   => $users['developer'],
                'action'      => 'add',
                'description' => 'admin added developer to the project',
                'old_values'  => null,
                'new_values'  => json_encode(['user' => 'developer', 'role' => 'member'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(20)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['admin'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'task',
                'entity_id'   => $taskIds['Build authentication'],
                'action'      => 'create',
                'description' => 'admin created the task Build authentication',
                'old_values'  => null,
                'new_values'  => json_encode(['title' => 'Build authentication', 'status' => 'todo'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(14)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['developer'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'task',
                'entity_id'   => $taskIds['Build authentication'],
                'action'      => 'update',
                'description' => 'developer moved Build authentication from todo to in_progress',
                'old_values'  => json_encode(['status' => 'todo'], JSON_THROW_ON_ERROR),
                'new_values'  => json_encode(['status' => 'in_progress'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(9)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['designer'],
                'project_id'  => $projectIds['Website Redesign'],
                'entity_type' => 'task',
                'entity_id'   => $taskIds['Design homepage'],
                'action'      => 'complete',
                'description' => 'designer completed Design homepage',
                'old_values'  => json_encode(['status' => 'review'], JSON_THROW_ON_ERROR),
                'new_values'  => json_encode(['status' => 'completed'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(11)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['manager'],
                'project_id'  => $projectIds['Marketing Campaign'],
                'entity_type' => 'project',
                'entity_id'   => $projectIds['Marketing Campaign'],
                'action'      => 'update',
                'description' => 'manager put the campaign on hold',
                'old_values'  => json_encode(['status' => 'active'], JSON_THROW_ON_ERROR),
                'new_values'  => json_encode(['status' => 'on_hold'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(7)->toDateTimeString(),
            ],
            [
                'user_id'     => $users['manager'],
                'project_id'  => $projectIds['Mobile Application'],
                'entity_type' => 'project',
                'entity_id'   => $projectIds['Mobile Application'],
                'action'      => 'create',
                'description' => 'manager created the project Mobile Application',
                'old_values'  => null,
                'new_values'  => json_encode(['name' => 'Mobile Application', 'status' => 'planning'], JSON_THROW_ON_ERROR),
                'created_at'  => $now->subDays(5)->toDateTimeString(),
            ],
        ]);
    }
}
