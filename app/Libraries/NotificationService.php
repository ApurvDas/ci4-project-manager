<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\NotificationModel;
use App\Models\ProjectMemberModel;
use App\Models\TaskAssigneeModel;
use App\Models\TaskModel;

/**
 * Turns domain events into notifications.
 *
 * Kept separate from the services that perform the writes so that "who should
 * hear about this" is decided in one place, and so a failure to notify can
 * never roll back the change that caused it — notifications are sent after the
 * transaction commits.
 *
 * The actor is always excluded: nobody needs telling about their own action.
 */
class NotificationService
{
    private NotificationModel $notifications;
    private TaskModel $tasks;
    private TaskAssigneeModel $assignees;

    public function __construct()
    {
        $this->notifications = model(NotificationModel::class);
        $this->tasks         = model(TaskModel::class);
        $this->assignees     = model(TaskAssigneeModel::class);
    }

    /**
     * Tell people they have just been put on a task.
     *
     * @param list<int> $userIds the newly added assignees only
     */
    public function taskAssigned(int $taskId, int $actorId, array $userIds): void
    {
        if ($userIds === []) {
            return;
        }

        $task = $this->tasks->find($taskId);

        if ($task === null) {
            return;
        }

        $this->notifications->notifyMany(
            $userIds,
            $actorId,
            NotificationModel::TYPE_TASK_ASSIGNED,
            'You were assigned a task',
            $task['title'],
            'task',
            $taskId,
        );
    }

    public function taskStatusChanged(int $taskId, int $actorId, string $from, string $to): void
    {
        $task = $this->tasks->find($taskId);

        if ($task === null) {
            return;
        }

        $this->notifications->notifyMany(
            $this->interestedIn($task),
            $actorId,
            NotificationModel::TYPE_TASK_STATUS_CHANGED,
            'A task changed status',
            $task['title'] . ': ' . str_replace('_', ' ', $from) . ' → ' . str_replace('_', ' ', $to),
            'task',
            $taskId,
        );
    }

    public function commentAdded(int $taskId, int $actorId): void
    {
        $task = $this->tasks->find($taskId);

        if ($task === null) {
            return;
        }

        $this->notifications->notifyMany(
            $this->interestedIn($task),
            $actorId,
            NotificationModel::TYPE_COMMENT_ADDED,
            'New comment on a task',
            $task['title'],
            'task',
            $taskId,
        );
    }

    public function memberAdded(int $projectId, int $actorId, int $userId, string $projectName): void
    {
        $this->notifications->notifyMany(
            [$userId],
            $actorId,
            NotificationModel::TYPE_PROJECT_INVITATION,
            'You were added to a project',
            $projectName,
            'project',
            $projectId,
        );
    }

    /**
     * Everyone with a stake in a task: its assignees plus whoever created it.
     *
     * @param array<string, mixed> $task
     *
     * @return list<int>
     */
    private function interestedIn(array $task): array
    {
        $userIds   = $this->assignees->userIdsFor((int) $task['id']);
        $userIds[] = (int) $task['created_by'];

        return array_values(array_unique($userIds));
    }
}
