<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Database\ConnectionInterface;
use CodeIgniter\I18n\Time;
use CodeIgniter\Model;
use CodeIgniter\Validation\ValidationInterface;

class TaskModel extends Model
{
    /**
     * Also the left-to-right column order of the Kanban board.
     */
    public const STATUSES = ['todo', 'in_progress', 'review', 'completed'];

    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    public const STATUS_COMPLETED = 'completed';

    protected $table         = 'tasks';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'project_id',
        'created_by',
        'title',
        'description',
        'status',
        'priority',
        'position',
        'start_date',
        'due_date',
        'completed_at',
    ];

    protected $useTimestamps  = true;
    protected $useSoftDeletes = true;
    protected $dateFormat     = 'datetime';

    protected $validationRules = [
        'project_id'  => 'required|is_natural_no_zero',
        'created_by'  => 'required|is_natural_no_zero',
        'title'       => 'required|string|min_length[3]|max_length[200]',
        'description' => 'permit_empty|string|max_length[5000]',
        'position'    => 'permit_empty|is_natural',
        'start_date'  => 'permit_empty|valid_date[Y-m-d]',
        'due_date'    => 'permit_empty|valid_date[Y-m-d]',
    ];

    protected $validationMessages = [
        'title' => [
            'required'   => 'A task title is required.',
            'min_length' => 'Task titles must be at least 3 characters long.',
        ],
    ];

    public function __construct(?ConnectionInterface $db = null, ?ValidationInterface $validation = null)
    {
        parent::__construct($db, $validation);

        $this->validationRules['status']   = 'required|in_list[' . implode(',', self::STATUSES) . ']';
        $this->validationRules['priority'] = 'required|in_list[' . implode(',', self::PRIORITIES) . ']';
    }

    /**
     * The Kanban board: tasks grouped by status, ordered by position, with every
     * column present even when empty so the view can render it unconditionally.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function boardFor(int $projectId): array
    {
        $board = array_fill_keys(self::STATUSES, []);

        $tasks = $this->where('project_id', $projectId)
            ->orderBy('position', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();

        foreach ($tasks as $task) {
            $board[$task['status']][] = $task;
        }

        return $board;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function forProject(int $projectId): array
    {
        return $this->where('project_id', $projectId)
            ->orderBy('due_date', 'ASC')
            ->orderBy('id', 'DESC')
            ->findAll();
    }

    /**
     * The position a new task should take at the end of a Kanban column.
     */
    public function nextPosition(int $projectId, string $status): int
    {
        $row = $this->select('COALESCE(MAX(position), -1) + 1 AS next_position', false)
            ->where('project_id', $projectId)
            ->where('status', $status)
            ->first();

        return (int) ($row['next_position'] ?? 0);
    }

    /**
     * Tasks assigned to a user across every project they belong to.
     *
     * @return list<array<string, mixed>>
     */
    public function assignedTo(int $userId, ?int $limit = null): array
    {
        $this->select('tasks.*, projects.name AS project_name')
            ->join('task_assignees', 'task_assignees.task_id = tasks.id')
            ->join('projects', 'projects.id = tasks.project_id')
            ->where('task_assignees.user_id', $userId)
            ->where('projects.deleted_at', null)
            ->orderBy('tasks.due_date', 'ASC');

        return $limit === null ? $this->findAll() : $this->findAll($limit);
    }

    /**
     * Task counts for the dashboard, all scoped to what this user is assigned.
     *
     * @return array<string, int>
     */
    public function dashboardCountsFor(int $userId): array
    {
        return [
            'assigned'  => $this->countAssignedTo($userId),
            'overdue'   => $this->countOverdueFor($userId),
            'due_today' => $this->countDueTodayFor($userId),
            'completed' => $this->countCompletedFor($userId),
        ];
    }

    public function countAssignedTo(int $userId): int
    {
        return $this->assignedScope($userId)->countAllResults();
    }

    public function countOverdueFor(int $userId): int
    {
        return $this->assignedScope($userId)
            ->where('tasks.status !=', self::STATUS_COMPLETED)
            ->where('tasks.due_date <', Time::now()->toDateString())
            ->countAllResults();
    }

    public function countDueTodayFor(int $userId): int
    {
        return $this->assignedScope($userId)
            ->where('tasks.status !=', self::STATUS_COMPLETED)
            ->where('tasks.due_date', Time::now()->toDateString())
            ->countAllResults();
    }

    public function countCompletedFor(int $userId): int
    {
        return $this->assignedScope($userId)
            ->where('tasks.status', self::STATUS_COMPLETED)
            ->countAllResults();
    }

    /**
     * Status counts for a single project, used by the project dashboard.
     *
     * @return array<string, int>
     */
    public function statusCountsFor(int $projectId): array
    {
        $counts = array_fill_keys(self::STATUSES, 0);

        $rows = $this->select('status, COUNT(*) AS total')
            ->where('project_id', $projectId)
            ->groupBy('status')
            ->findAll();

        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * Shared join for "tasks assigned to this user", excluding tasks whose
     * project has been soft deleted.
     */
    private function assignedScope(int $userId): self
    {
        return $this->join('task_assignees', 'task_assignees.task_id = tasks.id')
            ->join('projects', 'projects.id = tasks.project_id')
            ->where('task_assignees.user_id', $userId)
            ->where('projects.deleted_at', null);
    }
}
