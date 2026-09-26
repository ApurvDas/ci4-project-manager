<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Exceptions\PageNotFoundException;
use Tests\Support\FeatureTestCase;

/**
 * Membership changes and the privileges they require.
 *
 * Website Redesign already contains every seeded user, so tests that need a
 * candidate free one up first. Marketing Campaign (manager owns it, designer is
 * a member) is used where a spare candidate is needed.
 *
 * @internal
 */
final class ProjectMembersTest extends FeatureTestCase
{
    /**
     * Detach a user so they become an "add member" candidate again.
     */
    private function detach(int $projectId, int $userId): void
    {
        $this->db->table('project_members')
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->delete();
    }

    public function testManagerCanAddAPlainMember(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('manager')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'member',
        ]);

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
            'role'       => 'member',
        ]);
    }

    public function testManagerCannotAppointAnotherManager(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('manager')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'manager',
        ]);

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
        ]);
    }

    public function testOwnerCanAppointAManager(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('admin')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'manager',
        ]);

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
            'role'       => 'manager',
        ]);
    }

    public function testNobodyCanCreateASecondOwner(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('admin')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'owner',
        ]);

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
        ]);
    }

    public function testPlainMemberCannotAddAnyone(): void
    {
        $projectId = $this->projectId('Marketing Campaign');
        $testerId  = $this->userId('tester');

        // designer is only a member of this project.
        $this->signIn('designer')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'viewer',
        ]);

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
        ]);
    }

    public function testNonMemberCannotAddAnyone(): void
    {
        $projectId = $this->projectId('Mobile Application');

        try {
            $this->signIn('designer')->submit("projects/{$projectId}/members", [
                'user_id' => $this->userId('admin'),
                'role'    => 'member',
            ]);

            $this->fail('A non-member must not be able to change membership.');
        } catch (PageNotFoundException) {
            // Expected.
        }

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $this->userId('admin'),
        ]);
    }

    public function testAnUnknownRoleIsRejected(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('admin')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'superuser',
        ]);

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
        ]);
    }

    public function testAddingSomeoneAlreadyInTheProjectChangesNothing(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');

        $this->signIn('admin')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'member',
        ]);

        // Still a viewer; the duplicate was refused rather than applied.
        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $testerId,
            'role'       => 'viewer',
        ]);
    }

    public function testAddingAMemberRecordsActivity(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $testerId  = $this->userId('tester');
        $this->detach($projectId, $testerId);

        $this->signIn('admin')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'member',
        ]);

        $this->seeInDatabase('activity_logs', [
            'project_id'  => $projectId,
            'entity_type' => 'member',
            'action'      => 'add',
            'entity_id'   => $testerId,
        ]);
    }

    public function testOwnerCanRemoveAManager(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $managerId = $this->userId('manager');

        $this->signIn('admin')->submit("projects/{$projectId}/members/{$managerId}/delete");

        $this->dontSeeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $managerId,
        ]);
    }

    public function testManagerCannotRemoveAnotherManager(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $managerId = $this->userId('manager');

        // manager is the only manager, so removing themselves is the manager case.
        $this->signIn('manager')->submit("projects/{$projectId}/members/{$managerId}/delete");

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $managerId,
        ]);
    }

    public function testTheOwnerCannotBeRemoved(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $ownerId   = $this->userId('admin');

        $this->signIn('admin')->submit("projects/{$projectId}/members/{$ownerId}/delete");

        // Removing the owner would leave the project with no administrator.
        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $ownerId,
            'role'       => 'owner',
        ]);
    }

    public function testViewerCannotRemoveAnyone(): void
    {
        $projectId  = $this->projectId('Website Redesign');
        $designerId = $this->userId('designer');

        $this->signIn('tester')->submit("projects/{$projectId}/members/{$designerId}/delete");

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $designerId,
        ]);
    }

    public function testOwnerCanChangeAMembersRole(): void
    {
        $projectId  = $this->projectId('Website Redesign');
        $designerId = $this->userId('designer');

        $this->signIn('admin')->submit("projects/{$projectId}/members/{$designerId}/role", [
            'role' => 'viewer',
        ]);

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $designerId,
            'role'       => 'viewer',
        ]);
    }

    public function testManagerCannotChangeRoles(): void
    {
        $projectId  = $this->projectId('Website Redesign');
        $designerId = $this->userId('designer');

        $this->signIn('manager')->submit("projects/{$projectId}/members/{$designerId}/role", [
            'role' => 'viewer',
        ]);

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $designerId,
            'role'       => 'member',
        ]);
    }

    public function testARoleChangeCannotGrantOwnership(): void
    {
        $projectId  = $this->projectId('Website Redesign');
        $designerId = $this->userId('designer');

        $this->signIn('admin')->submit("projects/{$projectId}/members/{$designerId}/role", [
            'role' => 'owner',
        ]);

        $this->seeInDatabase('project_members', [
            'project_id' => $projectId,
            'user_id'    => $designerId,
            'role'       => 'member',
        ]);
    }

    public function testRemovingAMemberRecordsActivity(): void
    {
        $projectId  = $this->projectId('Website Redesign');
        $designerId = $this->userId('designer');

        $this->signIn('admin')->submit("projects/{$projectId}/members/{$designerId}/delete");

        $this->seeInDatabase('activity_logs', [
            'project_id'  => $projectId,
            'entity_type' => 'member',
            'action'      => 'remove',
            'entity_id'   => $designerId,
        ]);
    }
}
