<?php

declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\I18n\Time;

/**
 * Development projects, their membership and their tags.
 *
 * Dates are relative to "now" so the dashboard always has a live mix of
 * upcoming, due-today and overdue work to display.
 */
class ProjectSeeder extends Seeder
{
    use ResolvesSeedIds;

    /**
     * owner, status, priority, start offset and due offset (days from today).
     */
    private const PROJECTS = [
        [
            'name'        => 'Website Redesign',
            'owner'       => 'admin',
            'description' => 'Rebuild the public marketing site with a new design system and a faster page load budget.',
            'status'      => 'active',
            'priority'    => 'high',
            'start'       => -30,
            'due'         => 14,
        ],
        [
            'name'        => 'Mobile Application',
            'owner'       => 'manager',
            'description' => 'Ship the first release of the companion mobile app for iOS and Android.',
            'status'      => 'planning',
            'priority'    => 'critical',
            'start'       => -5,
            'due'         => 60,
        ],
        [
            'name'        => 'Marketing Campaign',
            'owner'       => 'manager',
            'description' => 'Q3 launch campaign covering content, social and partner outreach.',
            'status'      => 'on_hold',
            'priority'    => 'medium',
            'start'       => -60,
            'due'         => -3,
        ],
        [
            'name'        => 'Internal Wiki',
            'owner'       => 'admin',
            'description' => 'Consolidate engineering runbooks into a single searchable knowledge base.',
            'status'      => 'completed',
            'priority'    => 'low',
            'start'       => -120,
            'due'         => -45,
        ],
    ];

    /**
     * The owner is stored as a member row too, so membership queries never need
     * to special-case projects.owner_id.
     */
    private const MEMBERS = [
        'Website Redesign' => [
            'admin' => 'owner', 'manager' => 'manager', 'designer' => 'member',
            'developer' => 'member', 'tester' => 'viewer',
        ],
        'Mobile Application' => [
            'manager' => 'owner', 'developer' => 'member', 'tester' => 'member',
        ],
        'Marketing Campaign' => [
            'manager' => 'owner', 'designer' => 'member',
        ],
        'Internal Wiki' => [
            'admin' => 'owner', 'developer' => 'member',
        ],
    ];

    private const TAGS = [
        'Website Redesign' => [
            'Design' => '#EC4899', 'Frontend' => '#3B82F6',
            'Backend' => '#10B981', 'Urgent' => '#EF4444',
        ],
        'Mobile Application' => [
            'iOS' => '#6366F1', 'Android' => '#22C55E', 'API' => '#F59E0B',
        ],
        'Marketing Campaign' => [
            'Content' => '#8B5CF6', 'Social' => '#06B6D4',
        ],
        'Internal Wiki' => [
            'Docs' => '#64748B',
        ],
    ];

    public function run(): void
    {
        $users = $this->userIds();
        $now   = Time::now();

        $projects = [];

        foreach (self::PROJECTS as $project) {
            $createdAt = $now->subDays(abs($project['start']))->toDateTimeString();

            $projects[] = [
                'owner_id'    => $users[$project['owner']],
                'name'        => $project['name'],
                'description' => $project['description'],
                'status'      => $project['status'],
                'priority'    => $project['priority'],
                'start_date'  => $now->addDays($project['start'])->toDateString(),
                'due_date'    => $now->addDays($project['due'])->toDateString(),
                'created_at'  => $createdAt,
                'updated_at'  => $createdAt,
            ];
        }

        $this->db->table('projects')->insertBatch($projects);

        $projectIds = $this->projectIds();

        $members = [];

        foreach (self::MEMBERS as $projectName => $roles) {
            foreach ($roles as $username => $role) {
                $members[] = [
                    'project_id' => $projectIds[$projectName],
                    'user_id'    => $users[$username],
                    'role'       => $role,
                    'joined_at'  => $now->subDays(20)->toDateTimeString(),
                ];
            }
        }

        $this->db->table('project_members')->insertBatch($members);

        $tags = [];

        foreach (self::TAGS as $projectName => $colours) {
            foreach ($colours as $name => $colour) {
                $tags[] = [
                    'project_id' => $projectIds[$projectName],
                    'name'       => $name,
                    'color'      => $colour,
                    'created_at' => $now->subDays(20)->toDateTimeString(),
                ];
            }
        }

        $this->db->table('tags')->insertBatch($tags);
    }
}
