<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\ProjectModel;
use Tests\Support\ModelTestCase;

/**
 * @internal
 */
final class ProjectModelTest extends ModelTestCase
{
    private ProjectModel $projects;

    protected function setUp(): void
    {
        parent::setUp();

        $this->projects = model(ProjectModel::class);
    }

    public function testForUserReturnsOnlyProjectsTheUserBelongsTo(): void
    {
        $names = array_column($this->projects->forUser($this->userId('designer')), 'name');

        sort($names);

        $this->assertSame(['Marketing Campaign', 'Website Redesign'], $names);
    }

    public function testForUserIncludesTheRoleHeldInEachProject(): void
    {
        $projects = $this->projects->forUser($this->userId('tester'));
        $roles    = array_column($projects, 'role', 'name');

        $this->assertSame('viewer', $roles['Website Redesign']);
        $this->assertSame('member', $roles['Mobile Application']);
    }

    public function testFindForUserReturnsNullWhenTheUserIsNotAMember(): void
    {
        // designer has no membership in Mobile Application.
        $this->assertNull($this->projects->findForUser(
            $this->projectId('Mobile Application'),
            $this->userId('designer'),
        ));
    }

    public function testFindForUserReturnsTheProjectForAMember(): void
    {
        $project = $this->projects->findForUser(
            $this->projectId('Mobile Application'),
            $this->userId('developer'),
        );

        $this->assertIsArray($project);
        $this->assertSame('Mobile Application', $project['name']);
        $this->assertSame('member', $project['role']);
    }

    public function testFindForUserReturnsNullForAMissingProject(): void
    {
        $this->assertNull($this->projects->findForUser(999999, $this->userId('admin')));
    }

    public function testSoftDeletedProjectsAreExcluded(): void
    {
        $this->projects->delete($this->projectId('Website Redesign'));

        $names = array_column($this->projects->forUser($this->userId('admin')), 'name');

        $this->assertSame(['Internal Wiki'], $names);
        // The row is still there, just flagged.
        $this->seeInDatabase('projects', ['name' => 'Website Redesign']);
    }

    public function testStatusCountsForUserCoversEveryStatus(): void
    {
        $counts = $this->projects->statusCountsForUser($this->userId('admin'));

        $this->assertSame(ProjectModel::STATUSES, array_keys($counts));
        $this->assertSame(1, $counts['active']);
        $this->assertSame(1, $counts['completed']);
        $this->assertSame(0, $counts['archived']);
    }

    public function testProgressIsDerivedFromTaskCompletion(): void
    {
        // Website Redesign has six tasks, one of them completed.
        $this->assertSame(17, $this->projects->progressFor($this->projectId('Website Redesign')));
        // Internal Wiki has two tasks, both completed.
        $this->assertSame(100, $this->projects->progressFor($this->projectId('Internal Wiki')));
    }

    public function testProgressIsZeroForAProjectWithNoTasks(): void
    {
        $projectId = $this->projects->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => 'Empty Project',
            'status'   => 'planning',
            'priority' => 'low',
        ], true);

        $this->assertSame(0, $this->projects->progressFor((int) $projectId));
    }

    public function testProgressForManyReturnsOneEntryPerProject(): void
    {
        $websiteId = $this->projectId('Website Redesign');
        $wikiId    = $this->projectId('Internal Wiki');

        $progress = $this->projects->progressForMany([$websiteId, $wikiId]);

        $this->assertSame(17, $progress[$websiteId]);
        $this->assertSame(100, $progress[$wikiId]);
    }

    public function testProgressForManyIncludesProjectsWithNoTasks(): void
    {
        $emptyId = (int) $this->projects->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => 'Untouched Project',
            'status'   => 'planning',
            'priority' => 'low',
        ], true);

        $progress = $this->projects->progressForMany([$emptyId]);

        // A project with no tasks still needs a key, or the view has to guard.
        $this->assertArrayHasKey($emptyId, $progress);
        $this->assertSame(0, $progress[$emptyId]);
    }

    public function testProgressForManyWithNoProjects(): void
    {
        $this->assertSame([], $this->projects->progressForMany([]));
    }

    public function testProgressForManyMatchesTheSingleProjectCalculation(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $this->assertSame(
            $this->projects->progressFor($projectId),
            $this->projects->progressForMany([$projectId])[$projectId],
        );
    }

    public function testInvalidStatusIsRejected(): void
    {
        $result = $this->projects->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => 'Bad Status',
            'status'   => 'nonsense',
            'priority' => 'low',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('status', $this->projects->errors());
    }

    public function testShortNameIsRejected(): void
    {
        $result = $this->projects->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => 'ab',
            'status'   => 'planning',
            'priority' => 'low',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('name', $this->projects->errors());
    }

    public function testTimestampsArePopulatedOnInsert(): void
    {
        $id = $this->projects->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => 'Timestamped Project',
            'status'   => 'planning',
            'priority' => 'low',
        ], true);

        $project = $this->projects->find($id);

        $this->assertNotNull($project['created_at']);
        $this->assertNotNull($project['updated_at']);
        $this->assertNull($project['deleted_at']);
    }
}
