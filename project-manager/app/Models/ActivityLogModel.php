<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class ActivityLogModel extends Model
{
    public const ACTION_CREATE   = 'create';
    public const ACTION_UPDATE   = 'update';
    public const ACTION_DELETE   = 'delete';
    public const ACTION_ADD      = 'add';
    public const ACTION_REMOVE   = 'remove';
    public const ACTION_ASSIGN   = 'assign';
    public const ACTION_COMPLETE = 'complete';

    protected $table         = 'activity_logs';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'user_id',
        'project_id',
        'entity_type',
        'entity_id',
        'action',
        'description',
        'old_values',
        'new_values',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $updatedField  = '';

    /**
     * The value diffs are JSON columns; hand them to callers as arrays and
     * encode them again on the way in.
     */
    protected array $casts = [
        'old_values' => '?json[array]',
        'new_values' => '?json[array]',
    ];

    protected $validationRules = [
        'entity_type' => 'required|string|max_length[50]',
        'action'      => 'required|string|max_length[50]',
        'description' => 'permit_empty|string|max_length[255]',
        'user_id'     => 'permit_empty|is_natural_no_zero',
        'project_id'  => 'permit_empty|is_natural_no_zero',
        'entity_id'   => 'permit_empty|is_natural_no_zero',
    ];

    /**
     * Write one entry to the audit trail.
     *
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    public function record(
        string $entityType,
        string $action,
        ?int $entityId = null,
        ?int $userId = null,
        ?int $projectId = null,
        ?string $description = null,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): void {
        $this->insert([
            'user_id'     => $userId,
            'project_id'  => $projectId,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'action'      => $action,
            'description' => $description,
            'old_values'  => $oldValues,
            'new_values'  => $newValues,
        ]);
    }

    /**
     * The changed fields between two states, as [old, new].
     *
     * Only keys present in $after are compared, so passing a partial update
     * does not report every untouched column as a change.
     *
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     *
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    public static function diff(array $before, array $after): array
    {
        $old = [];
        $new = [];

        foreach ($after as $field => $value) {
            if (! array_key_exists($field, $before)) {
                continue;
            }

            // Loose comparison: values arriving from a form are strings while
            // the stored row may hold integers.
            if ((string) $before[$field] === (string) $value) {
                continue;
            }

            $old[$field] = $before[$field];
            $new[$field] = $value;
        }

        return [$old, $new];
    }

    /**
     * A project's activity feed, newest first, with the actor's username.
     *
     * @return list<array<string, mixed>>
     */
    public function recentForProject(int $projectId, int $limit = 20): array
    {
        return $this->select('activity_logs.*, users.username')
            ->join('users', 'users.id = activity_logs.user_id', 'left')
            ->where('activity_logs.project_id', $projectId)
            ->orderBy('activity_logs.created_at', 'DESC')
            ->orderBy('activity_logs.id', 'DESC')
            ->findAll($limit);
    }

    /**
     * Configure the query for a project's full history, optionally narrowed.
     *
     * Returns the model so the caller can paginate() it — the audit trail grows
     * without limit, so it must never be loaded whole.
     *
     * @param array{entity_type?: string, action?: string, user_id?: int|string} $filters
     */
    public function scopeForProject(int $projectId, array $filters = []): self
    {
        $this->select('activity_logs.*, users.username')
            ->join('users', 'users.id = activity_logs.user_id', 'left')
            ->where('activity_logs.project_id', $projectId);

        if (! empty($filters['entity_type'])) {
            $this->where('activity_logs.entity_type', $filters['entity_type']);
        }

        if (! empty($filters['action'])) {
            $this->where('activity_logs.action', $filters['action']);
        }

        if (! empty($filters['user_id'])) {
            $this->where('activity_logs.user_id', (int) $filters['user_id']);
        }

        return $this->orderBy('activity_logs.created_at', 'DESC')
            ->orderBy('activity_logs.id', 'DESC');
    }

    /**
     * The distinct values present in a project's history, for filter menus.
     * Built from the data rather than the constants, so a menu never offers a
     * choice that would return nothing.
     *
     * @return array{entity_types: list<string>, actions: list<string>}
     */
    public function filterOptionsFor(int $projectId): array
    {
        $rows = $this->db->table('activity_logs')
            ->select('DISTINCT entity_type, action', false)
            ->where('project_id', $projectId)
            ->get()
            ->getResultArray();

        $entityTypes = array_values(array_unique(array_column($rows, 'entity_type')));
        $actions     = array_values(array_unique(array_column($rows, 'action')));

        sort($entityTypes);
        sort($actions);

        return ['entity_types' => $entityTypes, 'actions' => $actions];
    }

    /**
     * The history of a single entity, for example one task.
     *
     * @return list<array<string, mixed>>
     */
    public function forEntity(string $entityType, int $entityId, int $limit = 20): array
    {
        return $this->select('activity_logs.*, users.username')
            ->join('users', 'users.id = activity_logs.user_id', 'left')
            ->where('activity_logs.entity_type', $entityType)
            ->where('activity_logs.entity_id', $entityId)
            ->orderBy('activity_logs.created_at', 'DESC')
            ->orderBy('activity_logs.id', 'DESC')
            ->findAll($limit);
    }
}
