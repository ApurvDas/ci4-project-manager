<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ActivityLogModel;
use App\Models\ProjectMemberModel;
use App\Models\ProjectModel;
use CodeIgniter\Database\BaseConnection;

/**
 * Write operations on a project and its membership.
 *
 * Each of these touches more than one table — the project row, the membership
 * rows and the audit trail — so they are wrapped in a transaction here rather
 * than spread across a controller.
 *
 * Authorisation is NOT performed here. Callers must consult ProjectPolicy
 * first; this class assumes the action has already been permitted, and exists
 * to keep the writes consistent.
 */
class ProjectService
{
    private ProjectModel $projects;
    private ProjectMemberModel $members;
    private ActivityLogModel $activity;
    private BaseConnection $db;

    public function __construct()
    {
        $this->projects = model(ProjectModel::class);
        $this->members  = model(ProjectMemberModel::class);
        $this->activity = model(ActivityLogModel::class);
        $this->db       = db_connect();
    }

    /**
     * Validation errors from the most recent failed call.
     *
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->projects->errors();
    }

    /**
     * Create a project and enrol its owner as a member in the same breath.
     *
     * The owner is stored both as projects.owner_id and as a project_members
     * row, so every membership query works without special-casing ownership.
     *
     * @param array<string, mixed> $data
     *
     * @return int|false the new project id, or false when validation failed
     */
    public function create(int $ownerId, array $data): int|false
    {
        $data['owner_id'] = $ownerId;

        $this->db->transBegin();

        $projectId = $this->projects->insert($data, true);

        if ($projectId === false) {
            $this->db->transRollback();

            return false;
        }

        $projectId = (int) $projectId;

        $this->members->insert([
            'project_id' => $projectId,
            'user_id'    => $ownerId,
            'role'       => ProjectMemberModel::ROLE_OWNER,
        ]);

        $this->activity->record(
            entityType: 'project',
            action: ActivityLogModel::ACTION_CREATE,
            entityId: $projectId,
            userId: $ownerId,
            projectId: $projectId,
            description: 'created the project ' . $data['name'],
            newValues: ['name' => $data['name'], 'status' => $data['status']],
        );

        $this->db->transCommit();

        return $projectId;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(int $projectId, int $actorId, array $data): bool
    {
        $before = $this->projects->find($projectId);

        if ($before === null) {
            return false;
        }

        $this->db->transBegin();

        if ($this->projects->update($projectId, $data) === false) {
            $this->db->transRollback();

            return false;
        }

        [$old, $new] = ActivityLogModel::diff($before, $data);

        // A save that changed nothing is not worth an audit entry.
        if ($new !== []) {
            $this->activity->record(
                entityType: 'project',
                action: ActivityLogModel::ACTION_UPDATE,
                entityId: $projectId,
                userId: $actorId,
                projectId: $projectId,
                description: 'updated the project settings',
                oldValues: $old,
                newValues: $new,
            );
        }

        $this->db->transCommit();

        return true;
    }

    /**
     * Move a project into the archived state. Reversible: the row is untouched
     * apart from its status.
     */
    public function archive(int $projectId, int $actorId): bool
    {
        return $this->changeStatus($projectId, $actorId, 'archived', 'archived the project');
    }

    public function reopen(int $projectId, int $actorId): bool
    {
        return $this->changeStatus($projectId, $actorId, 'active', 'reopened the project');
    }

    /**
     * Soft delete. The row and its history remain in the database.
     */
    public function delete(int $projectId, int $actorId): bool
    {
        $project = $this->projects->find($projectId);

        if ($project === null) {
            return false;
        }

        $this->db->transBegin();

        // Recorded before the delete so the audit entry is never orphaned by a
        // failure halfway through.
        $this->activity->record(
            entityType: 'project',
            action: ActivityLogModel::ACTION_DELETE,
            entityId: $projectId,
            userId: $actorId,
            projectId: $projectId,
            description: 'deleted the project ' . $project['name'],
            oldValues: ['name' => $project['name'], 'status' => $project['status']],
        );

        $this->projects->delete($projectId);

        $this->db->transCommit();

        return true;
    }

    public function addMember(int $projectId, int $actorId, int $userId, string $role): bool
    {
        if ($this->members->isMember($projectId, $userId)) {
            return false;
        }

        $this->db->transBegin();

        $inserted = $this->members->insert([
            'project_id' => $projectId,
            'user_id'    => $userId,
            'role'       => $role,
        ]);

        if ($inserted === false) {
            $this->db->transRollback();

            return false;
        }

        $this->activity->record(
            entityType: 'member',
            action: ActivityLogModel::ACTION_ADD,
            entityId: $userId,
            userId: $actorId,
            projectId: $projectId,
            description: 'added ' . $this->usernameOf($userId) . ' to the project',
            newValues: ['role' => $role],
        );

        $this->db->transCommit();

        return true;
    }

    public function removeMember(int $projectId, int $actorId, int $userId): bool
    {
        $role = $this->members->roleFor($projectId, $userId);

        if ($role === null) {
            return false;
        }

        $this->db->transBegin();

        $this->members->where('project_id', $projectId)->where('user_id', $userId)->delete();

        $this->activity->record(
            entityType: 'member',
            action: ActivityLogModel::ACTION_REMOVE,
            entityId: $userId,
            userId: $actorId,
            projectId: $projectId,
            description: 'removed ' . $this->usernameOf($userId) . ' from the project',
            oldValues: ['role' => $role],
        );

        $this->db->transCommit();

        return true;
    }

    public function changeRole(int $projectId, int $actorId, int $userId, string $role): bool
    {
        $current = $this->members->roleFor($projectId, $userId);

        if ($current === null || $current === $role) {
            return false;
        }

        $this->db->transBegin();

        $this->members
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->set('role', $role)
            ->update();

        $this->activity->record(
            entityType: 'member',
            action: ActivityLogModel::ACTION_UPDATE,
            entityId: $userId,
            userId: $actorId,
            projectId: $projectId,
            description: 'changed ' . $this->usernameOf($userId) . "'s role to " . $role,
            oldValues: ['role' => $current],
            newValues: ['role' => $role],
        );

        $this->db->transCommit();

        return true;
    }

    private function changeStatus(int $projectId, int $actorId, string $status, string $description): bool
    {
        $project = $this->projects->find($projectId);

        if ($project === null) {
            return false;
        }

        $this->db->transBegin();

        if ($this->projects->update($projectId, ['status' => $status]) === false) {
            $this->db->transRollback();

            return false;
        }

        $this->activity->record(
            entityType: 'project',
            action: ActivityLogModel::ACTION_UPDATE,
            entityId: $projectId,
            userId: $actorId,
            projectId: $projectId,
            description: $description,
            oldValues: ['status' => $project['status']],
            newValues: ['status' => $status],
        );

        $this->db->transCommit();

        return true;
    }

    private function usernameOf(int $userId): string
    {
        $row = $this->db->table('users')->select('username')->where('id', $userId)->get()->getRowArray();

        return $row['username'] ?? 'a user';
    }
}
