<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

/**
 * Join table between tasks and tags.
 *
 * There is no surrogate key — the (task_id, tag_id) pair is the primary key —
 * so this model deliberately does not use find()/update() by id. Work through
 * forTask() and syncForTask() instead.
 */
class TaskTagModel extends Model
{
    protected $table         = 'task_tags';
    protected $primaryKey    = 'task_id';
    protected $returnType    = 'array';
    protected $allowedFields = ['task_id', 'tag_id'];

    protected $useTimestamps = false;

    protected $validationRules = [
        'task_id' => 'required|is_natural_no_zero',
        'tag_id'  => 'required|is_natural_no_zero',
    ];

    /**
     * Tags attached to a task, ready to render as badges.
     *
     * @return list<array<string, mixed>>
     */
    public function forTask(int $taskId): array
    {
        return $this->select('tags.id, tags.name, tags.color')
            ->join('tags', 'tags.id = task_tags.tag_id')
            ->where('task_tags.task_id', $taskId)
            ->orderBy('tags.name', 'ASC')
            ->findAll();
    }

    /**
     * Tags for many tasks at once, keyed by task id.
     *
     * Lets the board and list views load every badge in one query instead of
     * one per card.
     *
     * @param list<int> $taskIds
     *
     * @return array<int, list<array<string, mixed>>>
     */
    public function forTasks(array $taskIds): array
    {
        if ($taskIds === []) {
            return [];
        }

        $rows = $this->select('task_tags.task_id, tags.id, tags.name, tags.color')
            ->join('tags', 'tags.id = task_tags.tag_id')
            ->whereIn('task_tags.task_id', $taskIds)
            ->orderBy('tags.name', 'ASC')
            ->findAll();

        $grouped = [];

        foreach ($rows as $row) {
            $taskId = (int) $row['task_id'];
            unset($row['task_id']);
            $grouped[$taskId][] = $row;
        }

        return $grouped;
    }

    /**
     * Replace a task's tags with the given set.
     *
     * @param list<int> $tagIds
     */
    public function syncForTask(int $taskId, array $tagIds): void
    {
        $wanted = array_values(array_unique(array_map('intval', $tagIds)));

        $this->where('task_id', $taskId)->delete();

        if ($wanted === []) {
            return;
        }

        $this->insertBatch(array_map(
            static fn (int $tagId): array => ['task_id' => $taskId, 'tag_id' => $tagId],
            $wanted,
        ));
    }
}
