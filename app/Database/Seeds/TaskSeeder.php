<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\I18n\Time;

/**
 * Development tasks and everything hanging off them: assignees, tags,
 * checklists, checklist items and comments.
 *
 * Assignees are always drawn from the project's own membership, and the due
 * dates deliberately include overdue, due-today and upcoming work so the
 * dashboard statistics have something meaningful to report.
 */
class TaskSeeder extends Seeder
{
    use ResolvesSeedIds;

    /**
     * 'due' and 'completed' are day offsets from today; null means unset.
     */
    private const TASKS = [
        'Website Redesign' => [
            [
                'title' => 'Design homepage', 'status' => 'completed', 'priority' => 'high',
                'created_by' => 'admin', 'assignees' => ['designer'], 'tags' => ['Design'],
                'due' => -12, 'completed' => -11,
                'description' => 'Produce the final homepage composition and hand off the spacing and type scale.',
            ],
            [
                'title' => 'Build authentication', 'status' => 'in_progress', 'priority' => 'critical',
                'created_by' => 'admin', 'assignees' => ['developer', 'tester'], 'tags' => ['Backend', 'Urgent'],
                'due' => 2, 'completed' => null,
                'description' => 'Wire up registration, login and password reset on top of CodeIgniter Shield.',
            ],
            [
                'title' => 'Create API', 'status' => 'in_progress', 'priority' => 'high',
                'created_by' => 'manager', 'assignees' => ['developer'], 'tags' => ['Backend'],
                'due' => 7, 'completed' => null,
                'description' => 'Expose the project and task endpoints consumed by the Kanban board.',
            ],
            [
                'title' => 'Migrate legacy content', 'status' => 'todo', 'priority' => 'medium',
                'created_by' => 'manager', 'assignees' => ['designer', 'tester'], 'tags' => ['Frontend'],
                'due' => 0, 'completed' => null,
                'description' => 'Move the remaining marketing pages across and check every redirect.',
            ],
            [
                'title' => 'Accessibility audit', 'status' => 'review', 'priority' => 'medium',
                'created_by' => 'admin', 'assignees' => ['tester'], 'tags' => ['Frontend'],
                'due' => -1, 'completed' => null,
                'description' => 'Audit against WCAG 2.2 AA and log every violation as a follow-up task.',
            ],
            [
                'title' => 'Deploy application', 'status' => 'todo', 'priority' => 'high',
                'created_by' => 'admin', 'assignees' => ['developer'], 'tags' => ['Backend', 'Urgent'],
                'due' => 12, 'completed' => null,
                'description' => 'Cut the production release once the audit findings are cleared.',
            ],
        ],
        'Mobile Application' => [
            [
                'title' => 'Set up CI pipeline', 'status' => 'todo', 'priority' => 'high',
                'created_by' => 'manager', 'assignees' => ['developer'], 'tags' => ['API'],
                'due' => 10, 'completed' => null,
                'description' => 'Build, test and sign both platforms on every push to main.',
            ],
            [
                'title' => 'Design onboarding flow', 'status' => 'todo', 'priority' => 'medium',
                'created_by' => 'manager', 'assignees' => ['manager'], 'tags' => ['iOS'],
                'due' => 18, 'completed' => null,
                'description' => 'Three-screen first-run experience with an option to skip.',
            ],
            [
                'title' => 'Implement push notifications', 'status' => 'in_progress', 'priority' => 'high',
                'created_by' => 'developer', 'assignees' => ['developer', 'tester'], 'tags' => ['iOS', 'Android'],
                'due' => 21, 'completed' => null,
                'description' => 'Deliver task assignment and due-date reminders to both platforms.',
            ],
        ],
        'Marketing Campaign' => [
            [
                'title' => 'Draft launch blog post', 'status' => 'review', 'priority' => 'medium',
                'created_by' => 'manager', 'assignees' => ['designer'], 'tags' => ['Content'],
                'due' => -5, 'completed' => null,
                'description' => 'Announcement post covering the redesign and the new mobile app.',
            ],
            [
                'title' => 'Schedule social posts', 'status' => 'todo', 'priority' => 'low',
                'created_by' => 'manager', 'assignees' => ['manager'], 'tags' => ['Social'],
                'due' => 5, 'completed' => null,
                'description' => 'Queue two weeks of posts across the usual channels.',
            ],
        ],
        'Internal Wiki' => [
            [
                'title' => 'Migrate runbooks', 'status' => 'completed', 'priority' => 'low',
                'created_by' => 'admin', 'assignees' => ['developer'], 'tags' => ['Docs'],
                'due' => -50, 'completed' => -48,
                'description' => 'Port the on-call runbooks over and retire the old shared drive.',
            ],
            [
                'title' => 'Write contribution guide', 'status' => 'completed', 'priority' => 'low',
                'created_by' => 'developer', 'assignees' => ['developer'], 'tags' => ['Docs'],
                'due' => -46, 'completed' => -46,
                'description' => 'Explain how to add and review a page.',
            ],
        ],
    ];

    /**
     * Checklist title => ordered items, keyed by task title.
     * Each item is [content, is_completed].
     */
    private const CHECKLISTS = [
        'Build authentication' => [
            'Authentication' => [
                ['Create login page', true],
                ['Add validation', true],
                ['Forgot password', false],
                ['Email verification', false],
            ],
        ],
        'Deploy application' => [
            'Launch checks' => [
                ['Run migrations', false],
                ['Smoke test the checkout', false],
                ['Enable database backups', false],
            ],
        ],
        'Draft launch blog post' => [
            'Editorial' => [
                ['Outline the structure', true],
                ['Write the first draft', true],
                ['Editorial review', false],
            ],
        ],
    ];

    /**
     * Task title => [[author, comment, day offset], ...]
     */
    private const COMMENTS = [
        'Build authentication' => [
            ['manager', 'Please keep everything on Shield rather than rolling our own session handling.', -4],
            ['developer', 'Agreed. Registration and login are done, password reset is next.', -2],
        ],
        'Design homepage' => [
            ['admin', 'Signed off. Nice work on the type scale.', -11],
        ],
        'Accessibility audit' => [
            ['tester', 'Found three contrast failures in the footer, raising them separately.', -1],
        ],
        'Draft launch blog post' => [
            ['designer', 'Draft is ready for review whenever you have a moment.', -5],
        ],
    ];

    public function run(): void
    {
        $users      = $this->userIds();
        $projectIds = $this->projectIds();
        $tagIds     = $this->tagIds();
        $now        = Time::now();

        $rows = [];

        foreach (self::TASKS as $projectName => $tasks) {
            $projectId = $projectIds[$projectName];
            // Kanban ordering restarts within each column.
            $positions = [];

            foreach ($tasks as $task) {
                $position                   = $positions[$task['status']] ?? 0;
                $positions[$task['status']] = $position + 1;

                $rows[] = [
                    'project_id'   => $projectId,
                    'created_by'   => $users[$task['created_by']],
                    'title'        => $task['title'],
                    'description'  => $task['description'],
                    'status'       => $task['status'],
                    'priority'     => $task['priority'],
                    'position'     => $position,
                    'start_date'   => $now->addDays($task['due'] - 7)->toDateString(),
                    'due_date'     => $now->addDays($task['due'])->toDateString(),
                    'completed_at' => $task['completed'] === null
                        ? null
                        : $now->addDays($task['completed'])->toDateTimeString(),
                    'created_at' => $now->subDays(14)->toDateTimeString(),
                    'updated_at' => $now->subDays(2)->toDateTimeString(),
                ];
            }
        }

        $this->db->table('tasks')->insertBatch($rows);

        $taskIds   = $this->taskIds();
        $assignees = [];
        $taskTags  = [];

        foreach (self::TASKS as $projectName => $tasks) {
            $projectId = $projectIds[$projectName];

            foreach ($tasks as $task) {
                $taskId = $taskIds[$task['title']];

                foreach ($task['assignees'] as $username) {
                    $assignees[] = [
                        'task_id'     => $taskId,
                        'user_id'     => $users[$username],
                        'assigned_at' => $now->subDays(10)->toDateTimeString(),
                    ];
                }

                foreach ($task['tags'] as $tagName) {
                    $taskTags[] = [
                        'task_id' => $taskId,
                        'tag_id'  => $tagIds[$projectId . ':' . $tagName],
                    ];
                }
            }
        }

        $this->db->table('task_assignees')->insertBatch($assignees);
        $this->db->table('task_tags')->insertBatch($taskTags);

        $this->seedChecklists($taskIds, $now);
        $this->seedComments($taskIds, $users, $now);
    }

    /**
     * @param array<string, int> $taskIds
     */
    private function seedChecklists(array $taskIds, Time $now): void
    {
        $checklists = [];

        foreach (self::CHECKLISTS as $taskTitle => $lists) {
            foreach (array_keys($lists) as $title) {
                $checklists[] = [
                    'task_id'    => $taskIds[$taskTitle],
                    'title'      => $title,
                    'created_at' => $now->subDays(12)->toDateTimeString(),
                    'updated_at' => $now->subDays(3)->toDateTimeString(),
                ];
            }
        }

        $this->db->table('task_checklists')->insertBatch($checklists);

        $checklistIds = [];

        foreach ($this->db->table('task_checklists')->select('id, title')->get()->getResultArray() as $row) {
            $checklistIds[$row['title']] = (int) $row['id'];
        }

        $items = [];

        foreach (self::CHECKLISTS as $lists) {
            foreach ($lists as $title => $entries) {
                foreach (array_values($entries) as $position => [$content, $isCompleted]) {
                    $items[] = [
                        'checklist_id' => $checklistIds[$title],
                        'content'      => $content,
                        'is_completed' => $isCompleted ? 1 : 0,
                        'position'     => $position,
                        'created_at'   => $now->subDays(12)->toDateTimeString(),
                        'updated_at'   => $now->subDays(3)->toDateTimeString(),
                        'completed_at' => $isCompleted ? $now->subDays(3)->toDateTimeString() : null,
                    ];
                }
            }
        }

        $this->db->table('task_checklist_items')->insertBatch($items);
    }

    /**
     * @param array<string, int> $taskIds
     * @param array<string, int> $users
     */
    private function seedComments(array $taskIds, array $users, Time $now): void
    {
        $comments = [];

        foreach (self::COMMENTS as $taskTitle => $entries) {
            foreach ($entries as [$author, $comment, $offset]) {
                $postedAt = $now->addDays($offset)->toDateTimeString();

                $comments[] = [
                    'task_id'    => $taskIds[$taskTitle],
                    'user_id'    => $users[$author],
                    'comment'    => $comment,
                    'created_at' => $postedAt,
                    'updated_at' => $postedAt,
                ];
            }
        }

        $this->db->table('task_comments')->insertBatch($comments);
    }
}
