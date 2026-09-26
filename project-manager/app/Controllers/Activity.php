<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ActivityLogModel;
use App\Models\ProjectMemberModel;

/**
 * A project's full history.
 *
 * Read-only, and open to every member: seeing what happened is part of viewing
 * the project. The trail itself is written by the services that make the
 * changes, never from here.
 */
class Activity extends ProjectScopedController
{
    private const PER_PAGE = 20;

    public function index(int $projectId): string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);

        $filters = [
            'entity_type' => trim((string) $this->request->getGet('entity_type')),
            'action'      => trim((string) $this->request->getGet('action')),
            'user_id'     => trim((string) $this->request->getGet('user_id')),
        ];

        $activity = model(ActivityLogModel::class);

        // The trail is unbounded, so it is always paginated.
        $entries = $activity->scopeForProject($projectId, $filters)->paginate(self::PER_PAGE);

        return view('activity/index', [
            'project' => $project,
            'entries' => $entries,
            'pager'   => $activity->pager,
            'filters' => $filters,
            'options' => model(ActivityLogModel::class)->filterOptionsFor($projectId),
            'members' => model(ProjectMemberModel::class)->membersOf($projectId),
        ]);
    }
}
