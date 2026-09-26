<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\TaskService;
use App\Models\TaskCommentModel;
use CodeIgniter\HTTP\RedirectResponse;

class TaskComments extends ProjectScopedController
{
    private TaskService $service;

    public function __construct()
    {
        parent::__construct();

        $this->service = new TaskService();
    }

    public function create(int $projectId, int $taskId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        $comment = trim((string) $this->request->getPost('comment'));

        if ($this->service->addComment($taskId, $userId, $comment) === false) {
            return redirect()->back()->withInput()->with('errors', $this->service->commentErrors());
        }

        return $this->backToTask($projectId, $taskId, 'message', 'Comment added.');
    }

    public function destroy(int $projectId, int $taskId, int $commentId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);

        $comment = model(TaskCommentModel::class)->find($commentId);

        // The comment must belong to the task in the URL.
        if ($comment === null || (int) $comment['task_id'] !== $taskId) {
            return $this->backToTask($projectId, $taskId, 'error', 'That comment no longer exists.');
        }

        if ($denied = $this->denyUnless($this->policy->canDeleteComment($projectId, $userId, $comment), $projectId)) {
            return $denied;
        }

        $this->service->deleteComment($commentId);

        return $this->backToTask($projectId, $taskId, 'message', 'Comment deleted.');
    }
}
