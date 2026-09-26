<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\TaskService;
use App\Models\TaskAssigneeModel;
use App\Models\TaskModel;
use App\Models\TaskTagModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * The Kanban board.
 *
 * Dragging a card issues a small JSON request to move(); the browser is never
 * trusted about what it is allowed to move. Every request re-checks membership,
 * that the task really belongs to this project, that the target column is a
 * real status, and that the user is a contributor rather than a viewer.
 */
class Board extends ProjectScopedController
{
    private TaskService $service;

    public function __construct()
    {
        parent::__construct();

        $this->service = new TaskService();
    }

    public function show(int $projectId): string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);

        $tasks = model(TaskModel::class);
        $board = $tasks->boardFor($projectId);

        $taskIds = [];

        foreach ($board as $column) {
            foreach ($column as $task) {
                $taskIds[] = (int) $task['id'];
            }
        }

        return view('board/show', [
            'project'        => $project,
            'board'          => $board,
            'tagsByTask'     => model(TaskTagModel::class)->forTasks($taskIds),
            'assigneesByTask' => $this->assigneesByTask($taskIds),
            'canWrite'       => $this->policy->canContribute($projectId, $userId),
        ]);
    }

    /**
     * Move a card. Responds with JSON for the board's fetch() call.
     */
    public function move(int $projectId, int $taskId): ResponseInterface
    {
        $userId = auth()->id();

        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);

        if (! $this->policy->canContribute($projectId, $userId)) {
            return $this->json(false, 'You do not have permission to move tasks.', 403);
        }

        $status   = (string) $this->request->getPost('status');
        $position = (int) $this->request->getPost('position');

        if (! in_array($status, TaskModel::STATUSES, true)) {
            return $this->json(false, 'That is not a valid column.', 422);
        }

        if (! $this->service->move($taskId, $userId, $status, max(0, $position))) {
            return $this->json(false, 'That task could not be moved.', 422);
        }

        return $this->json(true, 'Moved.');
    }

    /**
     * @param list<int> $taskIds
     *
     * @return array<int, list<string>>
     */
    private function assigneesByTask(array $taskIds): array
    {
        if ($taskIds === []) {
            return [];
        }

        $rows = model(TaskAssigneeModel::class)
            ->select('task_assignees.task_id, users.username')
            ->join('users', 'users.id = task_assignees.user_id')
            ->whereIn('task_assignees.task_id', $taskIds)
            ->orderBy('users.username', 'ASC')
            ->findAll();

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['task_id']][] = $row['username'];
        }

        return $grouped;
    }

    private function json(bool $ok, string $message, int $status = 200): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON([
            'ok'      => $ok,
            'message' => $message,
            // The CSRF token rotates on every request, so hand the board the
            // replacement or its next drag would be rejected.
            'csrf' => ['name' => csrf_token(), 'hash' => csrf_hash()],
        ]);
    }
}
