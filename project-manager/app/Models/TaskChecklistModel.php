<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class TaskChecklistModel extends Model
{
    protected $table         = 'task_checklists';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['task_id', 'title'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';

    protected $validationRules = [
        'task_id' => 'required|is_natural_no_zero',
        'title'   => 'required|string|min_length[1]|max_length[150]',
    ];

    /**
     * @return list<array<string, mixed>>
     */
    public function forTask(int $taskId): array
    {
        return $this->where('task_id', $taskId)
            ->orderBy('id', 'ASC')
            ->findAll();
    }

    /**
     * Checklists for a task with their items already attached and ordered,
     * so the task detail view needs two queries rather than one per checklist.
     *
     * @return list<array<string, mixed>>
     */
    public function forTaskWithItems(int $taskId): array
    {
        $checklists = $this->forTask($taskId);

        if ($checklists === []) {
            return [];
        }

        $items = model(TaskChecklistItemModel::class)
            ->forChecklists(array_column($checklists, 'id'));

        foreach ($checklists as $index => $checklist) {
            $checklists[$index]['items'] = $items[(int) $checklist['id']] ?? [];
        }

        return $checklists;
    }
}
