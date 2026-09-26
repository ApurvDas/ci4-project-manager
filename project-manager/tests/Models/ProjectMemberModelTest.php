<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\ProjectMemberModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use Tests\Support\ModelTestCase;

/**
 * @internal
 */
final class ProjectMemberModelTest extends ModelTestCase
{
    private ProjectMemberModel $members;

    protected function setUp(): void
    {
        parent::setUp();

        $this->members = model(ProjectMemberModel::class);
    }

    public function testRoleForReturnsTheStoredRole(): void
    {
        $this->assertSame('owner', $this->members->roleFor(
            $this->projectId('Website Redesign'),
            $this->userId('admin'),
        ));

        $this->assertSame('viewer', $this->members->roleFor(
            $this->projectId('Website Redesign'),
            $this->userId('tester'),
        ));
    }

    public function testRoleForReturnsNullForANonMember(): void
    {
        $this->assertNull($this->members->roleFor(
            $this->projectId('Mobile Application'),
            $this->userId('designer'),
        ));
    }

    public function testIsMemberReflectsMembership(): void
    {
        $projectId = $this->projectId('Marketing Campaign');

        $this->assertTrue($this->members->isMember($projectId, $this->userId('designer')));
        $this->assertFalse($this->members->isMember($projectId, $this->userId('tester')));
    }

    public function testHasAtLeastComparesRoleSeniority(): void
    {
        $projectId = $this->projectId('Website Redesign');

        // admin is owner, which outranks every other role.
        $this->assertTrue($this->members->hasAtLeast($projectId, $this->userId('admin'), ProjectMemberModel::ROLE_MANAGER));
        $this->assertTrue($this->members->hasAtLeast($projectId, $this->userId('admin'), ProjectMemberModel::ROLE_OWNER));

        // tester is a viewer, so anything above read-only must be refused.
        $this->assertTrue($this->members->hasAtLeast($projectId, $this->userId('tester'), ProjectMemberModel::ROLE_VIEWER));
        $this->assertFalse($this->members->hasAtLeast($projectId, $this->userId('tester'), ProjectMemberModel::ROLE_MEMBER));
        $this->assertFalse($this->members->hasAtLeast($projectId, $this->userId('tester'), ProjectMemberModel::ROLE_MANAGER));
    }

    public function testHasAtLeastIsFalseForANonMember(): void
    {
        $this->assertFalse($this->members->hasAtLeast(
            $this->projectId('Mobile Application'),
            $this->userId('designer'),
            ProjectMemberModel::ROLE_VIEWER,
        ));
    }

    public function testMembersOfListsTheMostPrivilegedFirst(): void
    {
        $members = $this->members->membersOf($this->projectId('Website Redesign'));

        $this->assertSame('owner', $members[0]['role']);
        $this->assertSame('admin', $members[0]['username']);
        $this->assertSame('manager', $members[1]['role']);
        $this->assertSame('viewer', end($members)['role']);
    }

    public function testMembersOfIncludesUsernames(): void
    {
        $usernames = array_column($this->members->membersOf($this->projectId('Internal Wiki')), 'username');

        sort($usernames);

        $this->assertSame(['admin', 'developer'], $usernames);
    }

    public function testUserIdsForReturnsIntegers(): void
    {
        $ids = $this->members->userIdsFor($this->projectId('Marketing Campaign'));

        $this->assertCount(2, $ids);
        $this->assertContainsOnly('int', $ids);
        $this->assertContains($this->userId('manager'), $ids);
    }

    public function testTheSameUserCannotJoinAProjectTwice(): void
    {
        $this->expectException(DatabaseException::class);

        $this->members->insert([
            'project_id' => $this->projectId('Website Redesign'),
            'user_id'    => $this->userId('admin'),
            'role'       => 'member',
        ]);
    }

    public function testInvalidRoleIsRejected(): void
    {
        $result = $this->members->insert([
            'project_id' => $this->projectId('Website Redesign'),
            'user_id'    => $this->userId('admin'),
            'role'       => 'superuser',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('role', $this->members->errors());
    }

    public function testJoinedAtIsPopulatedOnInsert(): void
    {
        $id = $this->members->insert([
            'project_id' => $this->projectId('Marketing Campaign'),
            'user_id'    => $this->userId('tester'),
            'role'       => 'member',
        ], true);

        $this->assertNotNull($this->members->find($id)['joined_at']);
    }
}
