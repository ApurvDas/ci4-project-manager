<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\ProjectMemberModel;

/**
 * Server-side authorisation for everything inside a project.
 *
 * Authentication (who you are) is Shield's job. This class answers the separate
 * question of what you may do *within a given project*, based on the role
 * stored in project_members.
 *
 * Every controller action must consult this before acting. Hiding a button in
 * a view is presentation, never protection.
 *
 * Capability ladder:
 *
 *   viewer   read the project
 *   member   + create and update tasks, comment, complete assigned work
 *   manager  + project settings, add and remove members and viewers
 *   owner    + delete or archive the project, change any member's role
 */
class ProjectPolicy
{
    private ProjectMemberModel $members;

    /**
     * Roles already looked up during this request, keyed "projectId:userId".
     *
     * A page asks the same questions repeatedly — the project view checks the
     * viewer's own role once per member row and once per tag, and each check
     * needs the actor's role as well as the target's. Without this the project
     * page issued more than thirty near-identical queries; with it, one per
     * distinct pair.
     *
     * The cache lives only as long as the instance, and controllers build a new
     * policy per request, so it cannot outlive a membership change. Anything
     * that alters membership mid-request should call flush() first.
     *
     * @var array<string, string|null>
     */
    private array $roleCache = [];

    public function __construct(?ProjectMemberModel $members = null)
    {
        $this->members = $members ?? model(ProjectMemberModel::class);
    }

    public function roleFor(int $projectId, int $userId): ?string
    {
        $key = $projectId . ':' . $userId;

        // array_key_exists, not isset: a non-member caches as null and must
        // stay cached rather than being looked up again on every check.
        if (! array_key_exists($key, $this->roleCache)) {
            $this->roleCache[$key] = $this->members->roleFor($projectId, $userId);
        }

        return $this->roleCache[$key];
    }

    /**
     * Discard cached roles. Call after changing membership within a request.
     */
    public function flush(): void
    {
        $this->roleCache = [];
    }

    /**
     * Any role at all. Non-members get nothing.
     */
    public function canView(int $projectId, int $userId): bool
    {
        return $this->roleFor($projectId, $userId) !== null;
    }

    /**
     * Create and update tasks, comment, tick checklists. Viewers cannot.
     */
    public function canContribute(int $projectId, int $userId): bool
    {
        return $this->atLeast($this->roleFor($projectId, $userId), ProjectMemberModel::ROLE_MEMBER);
    }

    /**
     * Edit project settings and manage the member list.
     */
    public function canManage(int $projectId, int $userId): bool
    {
        return $this->atLeast($this->roleFor($projectId, $userId), ProjectMemberModel::ROLE_MANAGER);
    }

    /**
     * Whether a held role is at least as privileged as the one required.
     *
     * Seniority comes from the order of ProjectMemberModel::ROLES, which runs
     * most privileged first, so there is no second copy of the hierarchy to
     * drift out of step with the model's.
     */
    private function atLeast(?string $role, string $minimum): bool
    {
        if ($role === null) {
            return false;
        }

        return array_search($role, ProjectMemberModel::ROLES, true)
            <= array_search($minimum, ProjectMemberModel::ROLES, true);
    }

    /**
     * Destructive or ownership-level actions: archive, delete, change roles.
     */
    public function canAdminister(int $projectId, int $userId): bool
    {
        return $this->roleFor($projectId, $userId) === ProjectMemberModel::ROLE_OWNER;
    }

    /**
     * Delete a task.
     *
     * Creating and updating tasks is open to every contributor, because that is
     * the everyday work of the project. Deleting one destroys someone else's
     * record of it, so it is limited to managers and the person who created it.
     *
     * @param array<string, mixed> $task
     */
    public function canDeleteTask(int $projectId, int $userId, array $task): bool
    {
        return $this->canManage($projectId, $userId)
            || (int) $task['created_by'] === $userId;
    }

    /**
     * Delete a comment: its author, or a manager clearing something up.
     *
     * @param array<string, mixed> $comment
     */
    public function canDeleteComment(int $projectId, int $userId, array $comment): bool
    {
        return $this->canManage($projectId, $userId)
            || (int) $comment['user_id'] === $userId;
    }

    /**
     * Tags are shared project furniture, so removing one affects every task
     * that uses it — managers only. Creating one is open to contributors.
     */
    public function canDeleteTag(int $projectId, int $userId): bool
    {
        return $this->canManage($projectId, $userId);
    }

    /**
     * Whether the actor may add someone with the given role.
     *
     * Managers may bring in members and viewers, but may not mint another
     * manager or a second owner — that is an ownership-level decision.
     */
    public function canAddMemberAs(int $projectId, int $actorId, string $role): bool
    {
        if (! $this->canManage($projectId, $actorId)) {
            return false;
        }

        if ($this->canAdminister($projectId, $actorId)) {
            // Even the owner may not create a second owner; ownership is
            // transferred, not duplicated.
            return $role !== ProjectMemberModel::ROLE_OWNER;
        }

        return in_array($role, [ProjectMemberModel::ROLE_MEMBER, ProjectMemberModel::ROLE_VIEWER], true);
    }

    /**
     * Whether the actor may remove a given member.
     *
     * The owner can never be removed — ownership would have to be transferred
     * first, otherwise the project is left without an administrator. Managers
     * may not remove one another; only the owner can.
     */
    public function canRemoveMember(int $projectId, int $actorId, int $targetUserId): bool
    {
        $targetRole = $this->roleFor($projectId, $targetUserId);

        if ($targetRole === null || $targetRole === ProjectMemberModel::ROLE_OWNER) {
            return false;
        }

        if (! $this->canManage($projectId, $actorId)) {
            return false;
        }

        if ($this->canAdminister($projectId, $actorId)) {
            return true;
        }

        return $targetRole !== ProjectMemberModel::ROLE_MANAGER;
    }

    /**
     * Only the owner changes roles, and the owner's own role is fixed.
     */
    public function canChangeRole(int $projectId, int $actorId, int $targetUserId, string $newRole): bool
    {
        if (! $this->canAdminister($projectId, $actorId)) {
            return false;
        }

        if ($newRole === ProjectMemberModel::ROLE_OWNER) {
            return false;
        }

        return $this->roleFor($projectId, $targetUserId) !== ProjectMemberModel::ROLE_OWNER;
    }
}
