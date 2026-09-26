<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\TaskService;
use App\Models\ActivityLogModel;
use App\Models\ProjectMemberModel;
use App\Models\TagModel;
use App\Models\TaskAssigneeModel;
use App\Models\TaskChecklistItemModel;
use App\Models\TaskChecklistModel;
use App\Models\TaskCommentModel;
use App\Models\TaskModel;
use App\Models\TaskTagModel;
use CodeIgniter\HTTP\RedirectResponse;

class Tasks extends ProjectScopedController
{
    private TaskService $service;

    public function __construct()
    {
        parent::__construct();

        $this->service = new TaskService();
    }

    /**
     * Flat task list for a project. The Kanban board is a separate view of the
     * same data.
     */
    public function index(int $projectId): string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);

        $tasks = model(TaskModel::class)->forProject($projectId);

        return view('tasks/index', [
            'project'   => $project,
            'tasks'     => $tasks,
            'tagsByTask' => model(TaskTagModel::class)->forTasks(array_column($tasks, 'id')),
            'canWrite'  => $this->policy->canContribute($projectId, $userId),
        ]);
    }

    public function form(int $projectId): RedirectResponse|string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        return view('tasks/form', [
            'project'         => $project,
            'task'            => null,
            'members'         => model(ProjectMemberModel::class)->membersOf($projectId),
            'tags'            => model(TagModel::class)->forProject($projectId),
            'selectedUsers'   => [],
            'selectedTags'    => [],
            'action'          => url_to('tasks.store', $projectId),
        ]);
    }

    public function store(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        $taskId = $this->service->create(
            $projectId,
            $userId,
            $this->taskInput(),
            $this->postedIds('assignees'),
            $this->postedIds('tags'),
        );

        if ($taskId === false) {
            return redirect()->back()->withInput()->with('errors', $this->service->errors());
        }

        return redirect()->to(url_to('tasks.show', $projectId, $taskId))->with('message', 'Task created.');
    }

    public function show(int $projectId, int $taskId): string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);
        $task    = $this->requireTask($projectId, $taskId);

        return view('tasks/show', [
            'project'    => $project,
            'task'       => $task,
            'assignees'  => model(TaskAssigneeModel::class)->forTask($taskId),
            'tags'       => model(TaskTagModel::class)->forTask($taskId),
            'comments'   => model(TaskCommentModel::class)->forTask($taskId),
            'checklists' => model(TaskChecklistModel::class)->forTaskWithItems($taskId),
            'progress'   => model(TaskChecklistItemModel::class)->progressForTask($taskId),
            'activity'   => model(ActivityLogModel::class)->forEntity('task', $taskId, 10),
            'canWrite'   => $this->policy->canContribute($projectId, $userId),
            'canDelete'  => $this->policy->canDeleteTask($projectId, $userId, $task),
            'policy'     => $this->policy,
            'userId'     => $userId,
        ]);
    }

    public function edit(int $projectId, int $taskId): RedirectResponse|string
    {
        $userId  = auth()->id();
        $project = $this->requireProject($projectId, $userId);
        $task    = $this->requireTask($projectId, $taskId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        return view('tasks/form', [
            'project'       => $project,
            'task'          => $task,
            'members'       => model(ProjectMemberModel::class)->membersOf($projectId),
            'tags'          => model(TagModel::class)->forProject($projectId),
            'selectedUsers' => model(TaskAssigneeModel::class)->userIdsFor($taskId),
            'selectedTags'  => array_map(
                static fn (array $tag): int => (int) $tag['id'],
                model(TaskTagModel::class)->forTask($taskId),
            ),
            'action' => url_to('tasks.update', $projectId, $taskId),
        ]);
    }

    public function update(int $projectId, int $taskId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $this->requireTask($projectId, $taskId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        $updated = $this->service->update(
            $taskId,
            $userId,
            $this->taskInput(),
            $this->postedIds('assignees'),
            $this->postedIds('tags'),
        );

        if (! $updated) {
            return redirect()->back()->withInput()->with('errors', $this->service->errors());
        }

        return redirect()->to(url_to('tasks.show', $projectId, $taskId))->with('message', 'Task updated.');
    }

    public function destroy(int $projectId, int $taskId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);
        $task = $this->requireTask($projectId, $taskId);

        if ($denied = $this->denyUnless($this->policy->canDeleteTask($projectId, $userId, $task), $projectId)) {
            return $denied;
        }

        $this->service->delete($taskId, $userId);

        return redirect()->to(url_to('projects.show', $projectId))->with('message', 'Task deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function taskInput(): array
    {
        $input = [
            'title'       => trim((string) $this->request->getPost('title')),
            'description' => trim((string) $this->request->getPost('description')),
            'status'      => (string) $this->request->getPost('status'),
            'priority'    => (string) $this->request->getPost('priority'),
            'start_date'  => (string) $this->request->getPost('start_date'),
            'due_date'    => (string) $this->request->getPost('due_date'),
        ];

        foreach (['description', 'start_date', 'due_date'] as $field) {
            if ($input[$field] === '') {
                $input[$field] = null;
            }
        }

        return $input;
    }

    /**
     * Posted checkbox arrays, cleaned to a list of positive integers.
     *
     * @return list<int>
     */
    private function postedIds(string $field): array
    {
        $values = $this->request->getPost($field);

        if (! is_array($values)) {
            return [];
        }

        return array_values(array_filter(array_map('intval', $values), static fn (int $id): bool => $id > 0));
    }
}
