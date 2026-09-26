<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class TaskAssigneeModel extends Model
{
    protected $table         = 'task_assignees';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['task_id', 'user_id'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'assigned_at';
    protected $updatedField  = '';

    protected $validationRules = [
        'task_id' => 'required|is_natural_no_zero',
        'user_id' => 'required|is_natural_no_zero',
    ];

    /**
     * Assignees of a task, with their usernames.
     *
     * @return list<array<string, mixed>>
     */
    public function forTask(int $taskId): array
    {
        return $this->select('task_assignees.*, users.username')
            ->join('users', 'users.id = task_assignees.user_id')
            ->where('task_assignees.task_id', $taskId)
            ->where('users.deleted_at', null)
            ->orderBy('users.username', 'ASC')
            ->findAll();
    }

    /**
     * @return list<int>
     */
    public function userIdsFor(int $taskId): array
    {
        $rows = $this->select('user_id')->where('task_id', $taskId)->findAll();

        return array_map(static fn (array $row): int => (int) $row['user_id'], $rows);
    }

    /**
     * Replace a task's assignees with the given set.
     *
     * Only the difference is written, so re-saving a task without changing its
     * assignees leaves assigned_at — and any notifications keyed off it — alone.
     *
     * @param list<int> $userIds
     *
     * @return array{added: list<int>, removed: list<int>}
     */
    public function syncForTask(int $taskId, array $userIds): array
    {
        $current = $this->userIdsFor($taskId);
        $wanted  = array_values(array_unique(array_map('intval', $userIds)));

        $added   = array_values(array_diff($wanted, $current));
        $removed = array_values(array_diff($current, $wanted));

        if ($added !== []) {
            $this->insertBatch(array_map(
                static fn (int $userId): array => ['task_id' => $taskId, 'user_id' => $userId],
                $added,
            ));
        }

        if ($removed !== []) {
            $this->where('task_id', $taskId)->whereIn('user_id', $removed)->delete();
        }

        return ['added' => $added, 'removed' => $removed];
    }
}
