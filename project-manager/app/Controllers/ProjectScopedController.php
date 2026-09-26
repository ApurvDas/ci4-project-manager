<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ProjectPolicy;
use App\Models\ProjectModel;
use App\Models\TaskModel;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\RedirectResponse;

/**
 * Shared guards for every controller that works inside a project.
 *
 * The two rules these enforce are easy to get wrong once per controller, so
 * they live in one place:
 *
 *  1. The signed-in user must be a member of the project, or the response is a
 *     not-found rather than a refusal — a refusal would confirm the project
 *     exists.
 *  2. A child record must belong to the project named in the URL. Without that
 *     check, a member of one project could read another project's tasks by
 *     guessing ids.
 */
abstract class ProjectScopedController extends BaseController
{
    protected ProjectPolicy $policy;

    public function __construct()
    {
        $this->policy = new ProjectPolicy();
    }

    /**
     * @return array<string, mixed>
     */
    protected function requireProject(int $projectId, int $userId): array
    {
        $project = model(ProjectModel::class)->findForUser($projectId, $userId);

        if ($project === null) {
            throw PageNotFoundException::forPageNotFound();
        }

        return $project;
    }

    /**
     * @return array<string, mixed>
     */
    protected function requireTask(int $projectId, int $taskId): array
    {
        $task = model(TaskModel::class)->find($taskId);

        if ($task === null || (int) $task['project_id'] !== $projectId) {
            throw PageNotFoundException::forPageNotFound();
        }

        return $task;
    }

    /**
     * Returns a redirect when the action is not permitted, null when it is.
     * Callers must return the redirect immediately.
     */
    protected function denyUnless(bool $allowed, int $projectId): ?RedirectResponse
    {
        if ($allowed) {
            return null;
        }

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('error', 'You do not have permission to do that.');
    }

    protected function backToTask(int $projectId, int $taskId, string $key, string $message): RedirectResponse
    {
        return redirect()->to(url_to('tasks.show', $projectId, $taskId))->with($key, $message);
    }
}
