<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\I18n\Time;
use CodeIgniter\Model;

class TaskChecklistItemModel extends Model
{
    protected $table         = 'task_checklist_items';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['checklist_id', 'content', 'is_completed', 'position', 'completed_at'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';

    /**
     * tinyint(1) in the database, bool in PHP.
     */
    protected array $casts = [
        'is_completed' => 'int-bool',
    ];

    protected $validationRules = [
        'checklist_id' => 'required|is_natural_no_zero',
        'content'      => 'required|string|min_length[1]|max_length[255]',
        'position'     => 'permit_empty|is_natural',
    ];

    /**
     * @return list<array<string, mixed>>
     */
    public function forChecklist(int $checklistId): array
    {
        return $this->where('checklist_id', $checklistId)
            ->orderBy('position', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
    }

    /**
     * Items for several checklists at once, keyed by checklist id.
     *
     * @param list<int> $checklistIds
     *
     * @return array<int, list<array<string, mixed>>>
     */
    public function forChecklists(array $checklistIds): array
    {
        if ($checklistIds === []) {
            return [];
        }

        $rows = $this->whereIn('checklist_id', $checklistIds)
            ->orderBy('position', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['checklist_id']][] = $row;
        }

        return $grouped;
    }

    public function nextPosition(int $checklistId): int
    {
        $row = $this->select('COALESCE(MAX(position), -1) + 1 AS next_position', false)
            ->where('checklist_id', $checklistId)
            ->first();

        return (int) ($row['next_position'] ?? 0);
    }

    /**
     * Tick or untick an item, keeping completed_at consistent with the flag.
     */
    public function setCompleted(int $itemId, bool $isCompleted): bool
    {
        return $this->update($itemId, [
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? Time::now()->toDateTimeString() : null,
        ]);
    }

    /**
     * Completed/total counts for a task, across all of its checklists.
     *
     * @return array{completed: int, total: int, percent: int}
     */
    public function progressForTask(int $taskId): array
    {
        $row = $this->db->table('task_checklist_items i')
            ->select('COUNT(*) AS total, SUM(i.is_completed) AS completed', false)
            ->join('task_checklists c', 'c.id = i.checklist_id')
            ->where('c.task_id', $taskId)
            ->get()
            ->getRowArray();

        $total     = (int) ($row['total'] ?? 0);
        $completed = (int) ($row['completed'] ?? 0);

        return [
            'completed' => $completed,
            'total'     => $total,
            'percent'   => $total === 0 ? 0 : (int) round(($completed / $total) * 100),
        ];
    }
}
