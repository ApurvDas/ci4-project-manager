<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ActivityLogModel;
use App\Models\TaskAssigneeModel;
use App\Models\TaskChecklistItemModel;
use App\Models\TaskChecklistModel;
use App\Models\TaskCommentModel;
use App\Models\TaskModel;
use App\Models\TaskTagModel;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\I18n\Time;

/**
 * Write operations on tasks and everything attached to them.
 *
 * As with ProjectService, each method touches several tables — the task, its
 * assignees, its tags and the audit trail — so the writes are grouped into a
 * transaction here instead of a controller.
 *
 * Authorisation is NOT performed here; callers must consult ProjectPolicy.
 */
class TaskService
{
    private TaskModel $tasks;
    private TaskAssigneeModel $assignees;
    private TaskTagModel $taskTags;
    private TaskCommentModel $comments;
    private TaskChecklistModel $checklists;
    private TaskChecklistItemModel $items;
    private ActivityLogModel $activity;
    private NotificationService $notifier;
    private BaseConnection $db;

    public function __construct()
    {
        $this->tasks      = model(TaskModel::class);
        $this->assignees  = model(TaskAssigneeModel::class);
        $this->taskTags   = model(TaskTagModel::class);
        $this->comments   = model(TaskCommentModel::class);
        $this->checklists = model(TaskChecklistModel::class);
        $this->items      = model(TaskChecklistItemModel::class);
        $this->activity   = model(ActivityLogModel::class);
        $this->notifier   = new NotificationService();
        $this->db         = db_connect();
    }

    /**
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->tasks->errors();
    }

    /**
     * @param array<string, mixed> $data
     * @param list<int>            $assigneeIds
     * @param list<int>            $tagIds
     *
     * @return int|false the new task id, or false when validation failed
     */
    public function create(int $projectId, int $actorId, array $data, array $assigneeIds = [], array $tagIds = []): int|false
    {
        $data['project_id'] = $projectId;
        $data['created_by'] = $actorId;
        $data['position']   = $this->tasks->nextPosition($projectId, (string) $data['status']);

        if ($data['status'] === TaskModel::STATUS_COMPLETED) {
            $data['completed_at'] = Time::now()->toDateTimeString();
        }

        $this->db->transBegin();

        $taskId = $this->tasks->insert($data, true);

        if ($taskId === false) {
            $this->db->transRollback();

            return false;
        }

        $taskId = (int) $taskId;

        $this->assignees->syncForTask($taskId, $assigneeIds);
        $this->taskTags->syncForTask($taskId, $tagIds);

        $this->activity->record(
            entityType: 'task',
            action: ActivityLogModel::ACTION_CREATE,
            entityId: $taskId,
            userId: $actorId,
            projectId: $projectId,
            description: 'created the task ' . $data['title'],
            newValues: ['title' => $data['title'], 'status' => $data['status']],
        );

        $this->db->transCommit();

        $this->notifier->taskAssigned($taskId, $actorId, $assigneeIds);

        return $taskId;
    }

    /**
     * @param array<string, mixed> $data
     * @param list<int>            $assigneeIds
     * @param list<int>            $tagIds
     */
    public function update(int $taskId, int $actorId, array $data, array $assigneeIds = [], array $tagIds = []): bool
    {
        $before = $this->tasks->find($taskId);

        if ($before === null) {
            return false;
        }

        $data = $this->applyCompletion($data, (string) $before['status']);

        // Moving to a different column puts the task at the end of it.
        if (isset($data['status']) && $data['status'] !== $before['status']) {
            $data['position'] = $this->tasks->nextPosition((int) $before['project_id'], (string) $data['status']);
        }

        $this->db->transBegin();

        if ($this->tasks->update($taskId, $data) === false) {
            $this->db->transRollback();

            return false;
        }

        $added = $this->assignees->syncForTask($taskId, $assigneeIds)['added'];
        $this->taskTags->syncForTask($taskId, $tagIds);

        [$old, $new] = ActivityLogModel::diff($before, $data);

        if ($new !== []) {
            $this->activity->record(
                entityType: 'task',
                action: isset($new['status']) && $new['status'] === TaskModel::STATUS_COMPLETED
                    ? ActivityLogModel::ACTION_COMPLETE
                    : ActivityLogModel::ACTION_UPDATE,
                entityId: $taskId,
                userId: $actorId,
                projectId: (int) $before['project_id'],
                description: 'updated the task ' . $before['title'],
                oldValues: $old,
                newValues: $new,
            );
        }

        $this->db->transCommit();

        $this->notifier->taskAssigned($taskId, $actorId, $added);

        if (isset($new['status'])) {
            $this->notifier->taskStatusChanged($taskId, $actorId, (string) $old['status'], (string) $new['status']);
        }

        return true;
    }

    /**
     * Move a task within, or between, Kanban columns.
     *
     * Positions are rewritten for the whole destination column so they stay a
     * dense 0..n sequence rather than drifting apart over time.
     */
    public function move(int $taskId, int $actorId, string $status, int $position): bool
    {
        $task = $this->tasks->find($taskId);

        if ($task === null || ! in_array($status, TaskModel::STATUSES, true)) {
            return false;
        }

        $projectId    = (int) $task['project_id'];
        $fromStatus   = (string) $task['status'];
        $statusChanged = $fromStatus !== $status;

        $this->db->transBegin();

        $update = ['status' => $status];

        if ($statusChanged) {
            $update = $this->applyCompletion($update, $fromStatus);
        }

        $this->tasks->update($taskId, $update);
        $this->resequence($projectId, $status, $taskId, $position);

        if ($statusChanged) {
            // Vacated column closes its gap too.
            $this->resequence($projectId, $fromStatus, null, null);

            $this->activity->record(
                entityType: 'task',
                action: $status === TaskModel::STATUS_COMPLETED
                    ? ActivityLogModel::ACTION_COMPLETE
                    : ActivityLogModel::ACTION_UPDATE,
                entityId: $taskId,
                userId: $actorId,
                projectId: $projectId,
                description: 'moved ' . $task['title'] . ' from ' . $fromStatus . ' to ' . $status,
                oldValues: ['status' => $fromStatus],
                newValues: ['status' => $status],
            );
        }

        $this->db->transCommit();

        if ($statusChanged) {
            $this->notifier->taskStatusChanged($taskId, $actorId, $fromStatus, $status);
        }

        return true;
    }

    public function delete(int $taskId, int $actorId): bool
    {
        $task = $this->tasks->find($taskId);

        if ($task === null) {
            return false;
        }

        $this->db->transBegin();

        $this->activity->record(
            entityType: 'task',
            action: ActivityLogModel::ACTION_DELETE,
            entityId: $taskId,
            userId: $actorId,
            projectId: (int) $task['project_id'],
            description: 'deleted the task ' . $task['title'],
            oldValues: ['title' => $task['title'], 'status' => $task['status']],
        );

        $this->tasks->delete($taskId);

        $this->db->transCommit();

        return true;
    }

    public function addComment(int $taskId, int $actorId, string $comment): int|false
    {
        $task = $this->tasks->find($taskId);

        if ($task === null) {
            return false;
        }

        $commentId = $this->comments->insert([
            'task_id' => $taskId,
            'user_id' => $actorId,
            'comment' => $comment,
        ], true);

        if ($commentId === false) {
            return false;
        }

        $this->activity->record(
            entityType: 'task',
            action: ActivityLogModel::ACTION_ADD,
            entityId: $taskId,
            userId: $actorId,
            projectId: (int) $task['project_id'],
            description: 'commented on ' . $task['title'],
        );

        $this->notifier->commentAdded($taskId, $actorId);

        return (int) $commentId;
    }

    /**
     * @return array<string, string>
     */
    public function commentErrors(): array
    {
        return $this->comments->errors();
    }

    public function deleteComment(int $commentId): bool
    {
        return (bool) $this->comments->delete($commentId);
    }

    public function addChecklist(int $taskId, string $title): int|false
    {
        return $this->checklists->insert(['task_id' => $taskId, 'title' => $title], true);
    }

    public function addChecklistItem(int $checklistId, string $content): int|false
    {
        return $this->items->insert([
            'checklist_id' => $checklistId,
            'content'      => $content,
            'position'     => $this->items->nextPosition($checklistId),
            'is_completed' => false,
        ], true);
    }

    public function toggleChecklistItem(int $itemId, bool $isCompleted): bool
    {
        return $this->items->setCompleted($itemId, $isCompleted);
    }

    /**
     * Keep completed_at consistent with the status being written.
     *
     * @param array<string, mixed> $data
     *
     * @return array<string, mixed>
     */
    private function applyCompletion(array $data, string $previousStatus): array
    {
        if (! isset($data['status'])) {
            return $data;
        }

        if ($data['status'] === TaskModel::STATUS_COMPLETED && $previousStatus !== TaskModel::STATUS_COMPLETED) {
            $data['completed_at'] = Time::now()->toDateTimeString();
        }

        if ($data['status'] !== TaskModel::STATUS_COMPLETED) {
            // Reopened work is no longer complete.
            $data['completed_at'] = null;
        }

        return $data;
    }

    /**
     * Rewrite a column's positions as 0..n, optionally inserting one task at a
     * chosen index.
     */
    private function resequence(int $projectId, string $status, ?int $movedTaskId, ?int $targetPosition): void
    {
        $ids = array_map(
            static fn (array $row): int => (int) $row['id'],
            $this->db->table('tasks')
                ->select('id')
                ->where('project_id', $projectId)
                ->where('status', $status)
                ->where('deleted_at', null)
                ->orderBy('position', 'ASC')
                ->orderBy('id', 'ASC')
                ->get()
                ->getResultArray(),
        );

        if ($movedTaskId !== null) {
            $ids = array_values(array_filter($ids, static fn (int $id): bool => $id !== $movedTaskId));
            $at  = max(0, min($targetPosition ?? count($ids), count($ids)));
            array_splice($ids, $at, 0, [$movedTaskId]);
        }

        foreach ($ids as $position => $id) {
            $this->db->table('tasks')->where('id', $id)->update(['position' => $position]);
        }
    }
}
