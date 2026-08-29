<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ProjectPolicy;
use App\Libraries\ProjectService;
use App\Models\ProjectMemberModel;
use App\Models\ProjectModel;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\RedirectResponse;

/**
 * Membership changes for a project.
 *
 * Kept apart from the Projects controller because the authorisation rules are
 * different: managing who is in a project is a narrower privilege than editing
 * the project itself, and removing or promoting someone is narrower still.
 */
class ProjectMembers extends BaseController
{
    private ProjectPolicy $policy;
    private ProjectService $service;

    public function __construct()
    {
        $this->policy  = new ProjectPolicy();
        $this->service = new ProjectService();
    }

    public function create(int $projectId): RedirectResponse
    {
        $actorId = auth()->id();
        $this->requireMembership($projectId, $actorId);

        $userId = (int) $this->request->getPost('user_id');
        $role   = (string) $this->request->getPost('role');

        if (! in_array($role, ProjectMemberModel::ROLES, true)) {
            return $this->back($projectId, 'error', 'That is not a valid role.');
        }

        if (! $this->policy->canAddMemberAs($projectId, $actorId, $role)) {
            return $this->back($projectId, 'error', 'You do not have permission to add someone as ' . $role . '.');
        }

        if ($userId <= 0 || ! $this->userExists($userId)) {
            return $this->back($projectId, 'error', 'Choose a person to add.');
        }

        if (! $this->service->addMember($projectId, $actorId, $userId, $role)) {
            return $this->back($projectId, 'error', 'That person is already a member of this project.');
        }

        return $this->back($projectId, 'message', 'Member added.');
    }

    public function updateRole(int $projectId, int $userId): RedirectResponse
    {
        $actorId = auth()->id();
        $this->requireMembership($projectId, $actorId);

        $role = (string) $this->request->getPost('role');

        if (! in_array($role, ProjectMemberModel::ROLES, true)) {
            return $this->back($projectId, 'error', 'That is not a valid role.');
        }

        if (! $this->policy->canChangeRole($projectId, $actorId, $userId, $role)) {
            return $this->back($projectId, 'error', 'You do not have permission to change that role.');
        }

        if (! $this->service->changeRole($projectId, $actorId, $userId, $role)) {
            return $this->back($projectId, 'error', 'That role could not be changed.');
        }

        return $this->back($projectId, 'message', 'Role updated.');
    }

    public function destroy(int $projectId, int $userId): RedirectResponse
    {
        $actorId = auth()->id();
        $this->requireMembership($projectId, $actorId);

        if (! $this->policy->canRemoveMember($projectId, $actorId, $userId)) {
            return $this->back($projectId, 'error', 'You do not have permission to remove that member.');
        }

        $this->service->removeMember($projectId, $actorId, $userId);

        return $this->back($projectId, 'message', 'Member removed.');
    }

    /**
     * A non-member must not be able to tell whether the project exists, so this
     * 404s rather than refusing.
     */
    private function requireMembership(int $projectId, int $actorId): void
    {
        if (model(ProjectModel::class)->findForUser($projectId, $actorId) === null) {
            throw PageNotFoundException::forPageNotFound();
        }
    }

    private function userExists(int $userId): bool
    {
        return db_connect()->table('users')
            ->where('id', $userId)
            ->where('deleted_at', null)
            ->countAllResults() > 0;
    }

    private function back(int $projectId, string $key, string $message): RedirectResponse
    {
        return redirect()->to(url_to('projects.show', $projectId))->with($key, $message);
    }
}
