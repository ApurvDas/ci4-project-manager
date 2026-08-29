<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\TaskService;
use App\Models\TaskChecklistItemModel;
use App\Models\TaskChecklistModel;
use CodeIgniter\HTTP\RedirectResponse;
use CodeIgniter\HTTP\ResponseInterface;

class TaskChecklists extends ProjectScopedController
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

        $title = trim((string) $this->request->getPost('title'));

        if ($title === '') {
            return $this->backToTask($projectId, $taskId, 'error', 'Give the checklist a title.');
        }

        $this->service->addChecklist($taskId, $title);

        return $this->backToTask($projectId, $taskId, 'message', 'Checklist added.');
    }

    public function createItem(int $projectId, int $taskId, int $checklistId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);
        $this->requireChecklist($taskId, $checklistId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        $content = trim((string) $this->request->getPost('content'));

        if ($content === '') {
            return $this->backToTask($projectId, $taskId, 'error', 'Write something for the item.');
        }

        $this->service->addChecklistItem($checklistId, $content);

        return $this->backToTask($projectId, $taskId, 'message', 'Item added.');
    }

    /**
     * Tick or untick an item.
     *
     * Answers JSON when asked for it, so the task page can update without a
     * reload, and falls back to a redirect when JavaScript is unavailable.
     */
    public function toggleItem(int $projectId, int $taskId, int $itemId): RedirectResponse|ResponseInterface
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);

        $item = model(TaskChecklistItemModel::class)->find($itemId);

        if ($item === null || ! $this->checklistBelongsToTask($taskId, (int) $item['checklist_id'])) {
            return $this->respondOrRedirect($projectId, $taskId, false, 'That item no longer exists.');
        }

        if (! $this->policy->canContribute($projectId, $userId)) {
            return $this->respondOrRedirect($projectId, $taskId, false, 'You do not have permission to do that.');
        }

        $this->service->toggleChecklistItem($itemId, ! $item['is_completed']);

        return $this->respondOrRedirect($projectId, $taskId, true, 'Checklist updated.');
    }

    private function requireChecklist(int $taskId, int $checklistId): void
    {
        if (! $this->checklistBelongsToTask($taskId, $checklistId)) {
            throw \CodeIgniter\Exceptions\PageNotFoundException::forPageNotFound();
        }
    }

    private function checklistBelongsToTask(int $taskId, int $checklistId): bool
    {
        $checklist = model(TaskChecklistModel::class)->find($checklistId);

        return $checklist !== null && (int) $checklist['task_id'] === $taskId;
    }

    private function respondOrRedirect(int $projectId, int $taskId, bool $ok, string $message): RedirectResponse|ResponseInterface
    {
        if ($this->request->isAJAX()) {
            $progress = model(TaskChecklistItemModel::class)->progressForTask($taskId);

            return $this->response
                ->setStatusCode($ok ? 200 : 403)
                ->setJSON([
                    'ok'       => $ok,
                    'message'  => $message,
                    'progress' => $progress,
                    // Tokens rotate on every request, so hand back the
                    // replacement or the next tick would be rejected.
                    'csrf' => ['name' => csrf_token(), 'hash' => csrf_hash()],
                ]);
        }

        return $this->backToTask($projectId, $taskId, $ok ? 'message' : 'error', $message);
    }
}
