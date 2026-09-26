<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\NotificationModel;
use App\Models\ProjectModel;
use App\Models\TaskModel;

class Dashboard extends BaseController
{
    /**
     * The signed-in user's overview.
     *
     * Every figure is read from the database and scoped to this user's project
     * membership and task assignments — nothing here is global or hard-coded.
     * The route is behind Shield's `session` filter, so `auth()->id()` is
     * always present.
     */
    public function index(): string
    {
        $userId = auth()->id();

        $projects      = model(ProjectModel::class);
        $tasks         = model(TaskModel::class);
        $notifications = model(NotificationModel::class);

        $projectCounts = $projects->statusCountsForUser($userId);
        $myProjects    = $projects->forUser($userId);

        return view('dashboard/index', [
            'projectCounts' => $projectCounts,
            'projectTotal'  => array_sum($projectCounts),
            'taskCounts'    => $tasks->dashboardCountsFor($userId),
            'unreadCount'   => $notifications->unreadCountFor($userId),
            'myTasks'       => $tasks->openAssignedTo($userId),
            'myProjects'    => $myProjects,
            'progress'      => $projects->progressForMany(array_column($myProjects, 'id')),
            'notifications' => $notifications->recentFor($userId, 5),
        ]);
    }
}
