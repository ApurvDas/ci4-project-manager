<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Database\ConnectionInterface;
use CodeIgniter\Model;
use CodeIgniter\Validation\ValidationInterface;

class ProjectModel extends Model
{
    /**
     * Allowed values for the status column. Kept here so forms, filters and the
     * validation rules below all read from one place.
     */
    public const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'];

    public const PRIORITIES = ['low', 'medium', 'high', 'critical'];

    protected $table         = 'projects';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'owner_id',
        'name',
        'description',
        'status',
        'priority',
        'start_date',
        'due_date',
    ];

    protected $useTimestamps  = true;
    protected $useSoftDeletes = true;
    protected $dateFormat     = 'datetime';

    protected $validationRules = [
        'owner_id'    => 'required|is_natural_no_zero',
        'name'        => 'required|string|min_length[3]|max_length[150]',
        'description' => 'permit_empty|string|max_length[5000]',
        'start_date'  => 'permit_empty|valid_date[Y-m-d]',
        'due_date'    => 'permit_empty|valid_date[Y-m-d]',
    ];

    protected $validationMessages = [
        'name' => [
            'required'   => 'A project name is required.',
            'min_length' => 'Project names must be at least 3 characters long.',
        ],
    ];

    public function __construct(?ConnectionInterface $db = null, ?ValidationInterface $validation = null)
    {
        parent::__construct($db, $validation);

        // Built from the constants so the enum column, the forms and the rules
        // can never drift apart.
        $this->validationRules['status']   = 'required|in_list[' . implode(',', self::STATUSES) . ']';
        $this->validationRules['priority'] = 'required|in_list[' . implode(',', self::PRIORITIES) . ']';
    }

    /**
     * Every project the user belongs to, with the role they hold in it.
     *
     * Membership is the access boundary, so this is the only listing the
     * controllers should use — never findAll().
     *
     * @return list<array<string, mixed>>
     */
    public function forUser(int $userId): array
    {
        return $this->select('projects.*, project_members.role')
            ->join('project_members', 'project_members.project_id = projects.id')
            ->where('project_members.user_id', $userId)
            ->orderBy('projects.due_date', 'ASC')
            ->orderBy('projects.id', 'DESC')
            ->findAll();
    }

    /**
     * A single project, but only if the user is a member of it. Returns null
     * when the project does not exist OR the user has no access, so callers
     * cannot accidentally leak the difference between the two.
     */
    public function findForUser(int $projectId, int $userId): ?array
    {
        return $this->select('projects.*, project_members.role')
            ->join('project_members', 'project_members.project_id = projects.id')
            ->where('project_members.user_id', $userId)
            ->where('projects.id', $projectId)
            ->first();
    }

    /**
     * Project counts per status for the dashboard, with every status present
     * so the view never has to guard against missing keys.
     *
     * @return array<string, int>
     */
    public function statusCountsForUser(int $userId): array
    {
        $counts = array_fill_keys(self::STATUSES, 0);

        $rows = $this->select('projects.status, COUNT(*) AS total')
            ->join('project_members', 'project_members.project_id = projects.id')
            ->where('project_members.user_id', $userId)
            ->groupBy('projects.status')
            ->findAll();

        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * Completion percentage for several projects at once, keyed by project id.
     *
     * One grouped query rather than one per row, so a dashboard listing many
     * projects stays a fixed number of queries.
     *
     * @param list<int> $projectIds
     *
     * @return array<int, int>
     */
    public function progressForMany(array $projectIds): array
    {
        if ($projectIds === []) {
            return [];
        }

        // Projects with no tasks at all produce no row below, so start every
        // requested id at zero.
        $progress = array_fill_keys(array_map('intval', $projectIds), 0);

        $rows = $this->db->table('tasks')
            ->select('project_id, COUNT(*) AS total')
            ->select("SUM(status = 'completed') AS completed", false)
            ->whereIn('project_id', $projectIds)
            ->where('deleted_at', null)
            ->groupBy('project_id')
            ->get()
            ->getResultArray();

        foreach ($rows as $row) {
            $total = (int) $row['total'];

            $progress[(int) $row['project_id']] = $total === 0
                ? 0
                : (int) round(((int) $row['completed'] / $total) * 100);
        }

        return $progress;
    }

    /**
     * Completion percentage derived from the project's tasks.
     */
    public function progressFor(int $projectId): int
    {
        $tasks = $this->db->table('tasks')
            ->selectCount('id', 'total')
            ->select("SUM(status = 'completed') AS completed", false)
            ->where('project_id', $projectId)
            ->where('deleted_at', null)
            ->get()
            ->getRowArray();

        $total = (int) ($tasks['total'] ?? 0);

        if ($total === 0) {
            return 0;
        }

        return (int) round(((int) $tasks['completed'] / $total) * 100);
    }
}
