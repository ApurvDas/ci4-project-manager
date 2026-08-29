<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Libraries\ProjectPolicy;
use App\Models\ProjectMemberModel;
use Tests\Support\ModelTestCase;

/**
 * The role ladder in isolation.
 *
 * Seeded roles in Website Redesign: admin owns it, manager manages it,
 * designer and developer are members, tester is a viewer.
 *
 * @internal
 */
final class ProjectPolicyTest extends ModelTestCase
{
    private ProjectPolicy $policy;
    private int $projectId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy    = new ProjectPolicy();
        $this->projectId = $this->projectId('Website Redesign');
    }

    public function testEveryMemberCanView(): void
    {
        foreach (['admin', 'manager', 'designer', 'tester'] as $username) {
            $this->assertTrue(
                $this->policy->canView($this->projectId, $this->userId($username)),
                $username . ' should be able to view the project',
            );
        }
    }

    public function testNonMembersCannotView(): void
    {
        $this->assertFalse($this->policy->canView(
            $this->projectId('Mobile Application'),
            $this->userId('designer'),
        ));
    }

    public function testViewersCannotContribute(): void
    {
        $this->assertTrue($this->policy->canContribute($this->projectId, $this->userId('designer')));
        $this->assertFalse($this->policy->canContribute($this->projectId, $this->userId('tester')));
    }

    public function testOnlyManagersAndAboveCanManage(): void
    {
        $this->assertTrue($this->policy->canManage($this->projectId, $this->userId('admin')));
        $this->assertTrue($this->policy->canManage($this->projectId, $this->userId('manager')));
        $this->assertFalse($this->policy->canManage($this->projectId, $this->userId('designer')));
        $this->assertFalse($this->policy->canManage($this->projectId, $this->userId('tester')));
    }

    public function testOnlyTheOwnerCanAdminister(): void
    {
        $this->assertTrue($this->policy->canAdminister($this->projectId, $this->userId('admin')));
        $this->assertFalse($this->policy->canAdminister($this->projectId, $this->userId('manager')));
    }

    public function testManagersMayOnlyAddMembersAndViewers(): void
    {
        $managerId = $this->userId('manager');

        $this->assertTrue($this->policy->canAddMemberAs($this->projectId, $managerId, ProjectMemberModel::ROLE_MEMBER));
        $this->assertTrue($this->policy->canAddMemberAs($this->projectId, $managerId, ProjectMemberModel::ROLE_VIEWER));
        // Minting another manager is an ownership-level decision.
        $this->assertFalse($this->policy->canAddMemberAs($this->projectId, $managerId, ProjectMemberModel::ROLE_MANAGER));
        $this->assertFalse($this->policy->canAddMemberAs($this->projectId, $managerId, ProjectMemberModel::ROLE_OWNER));
    }

    public function testOwnerMayAppointManagersButNeverASecondOwner(): void
    {
        $ownerId = $this->userId('admin');

        $this->assertTrue($this->policy->canAddMemberAs($this->projectId, $ownerId, ProjectMemberModel::ROLE_MANAGER));
        $this->assertFalse($this->policy->canAddMemberAs($this->projectId, $ownerId, ProjectMemberModel::ROLE_OWNER));
    }

    public function testPlainMembersCannotAddAnyone(): void
    {
        $this->assertFalse($this->policy->canAddMemberAs(
            $this->projectId,
            $this->userId('designer'),
            ProjectMemberModel::ROLE_VIEWER,
        ));
    }

    public function testTheOwnerCanNeverBeRemoved(): void
    {
        // Not even by themselves — the project would be left with no owner.
        $this->assertFalse($this->policy->canRemoveMember(
            $this->projectId,
            $this->userId('admin'),
            $this->userId('admin'),
        ));
    }

    public function testOwnerCanRemoveManagersAndMembers(): void
    {
        $ownerId = $this->userId('admin');

        $this->assertTrue($this->policy->canRemoveMember($this->projectId, $ownerId, $this->userId('manager')));
        $this->assertTrue($this->policy->canRemoveMember($this->projectId, $ownerId, $this->userId('tester')));
    }

    public function testManagersCannotRemoveOtherManagers(): void
    {
        $managerId = $this->userId('manager');

        $this->assertTrue($this->policy->canRemoveMember($this->projectId, $managerId, $this->userId('designer')));
        // manager is the only manager, so target themselves as the manager case.
        $this->assertFalse($this->policy->canRemoveMember($this->projectId, $managerId, $managerId));
    }

    public function testRemovingSomeoneWhoIsNotAMemberIsRefused(): void
    {
        $this->assertFalse($this->policy->canRemoveMember(
            $this->projectId('Marketing Campaign'),
            $this->userId('manager'),
            $this->userId('tester'),
        ));
    }

    public function testOnlyTheOwnerChangesRoles(): void
    {
        $designerId = $this->userId('designer');

        $this->assertTrue($this->policy->canChangeRole(
            $this->projectId,
            $this->userId('admin'),
            $designerId,
            ProjectMemberModel::ROLE_VIEWER,
        ));

        $this->assertFalse($this->policy->canChangeRole(
            $this->projectId,
            $this->userId('manager'),
            $designerId,
            ProjectMemberModel::ROLE_VIEWER,
        ));
    }

    public function testOwnershipCannotBeGrantedThroughARoleChange(): void
    {
        $this->assertFalse($this->policy->canChangeRole(
            $this->projectId,
            $this->userId('admin'),
            $this->userId('manager'),
            ProjectMemberModel::ROLE_OWNER,
        ));
    }

    public function testTheOwnersOwnRoleCannotBeChanged(): void
    {
        $ownerId = $this->userId('admin');

        $this->assertFalse($this->policy->canChangeRole(
            $this->projectId,
            $ownerId,
            $ownerId,
            ProjectMemberModel::ROLE_MANAGER,
        ));
    }
}
