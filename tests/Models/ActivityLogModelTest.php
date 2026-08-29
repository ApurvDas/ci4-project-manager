<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\ActivityLogModel;
use App\Models\ProjectModel;
use Tests\Support\ModelTestCase;

/**
 * @internal
 */
final class ActivityLogModelTest extends ModelTestCase
{
    private ActivityLogModel $activity;

    protected function setUp(): void
    {
        parent::setUp();

        $this->activity = model(ActivityLogModel::class);
    }

    public function testRecordRoundTripsValueDiffsAsArrays(): void
    {
        $this->activity->record(
            entityType: 'task',
            action: ActivityLogModel::ACTION_UPDATE,
            entityId: $this->taskId('Create API'),
            userId: $this->userId('developer'),
            projectId: $this->projectId('Website Redesign'),
            description: 'developer moved Create API to review',
            oldValues: ['status' => 'in_progress'],
            newValues: ['status' => 'review'],
        );

        $entry = $this->activity->forEntity('task', $this->taskId('Create API'))[0];

        // The JSON cast must hand these back as arrays, not strings.
        $this->assertSame(['status' => 'in_progress'], $entry['old_values']);
        $this->assertSame(['status' => 'review'], $entry['new_values']);
    }

    public function testRecordAcceptsNullValueDiffs(): void
    {
        $this->activity->record(
            entityType: 'project',
            action: ActivityLogModel::ACTION_CREATE,
            entityId: $this->projectId('Internal Wiki'),
            userId: $this->userId('admin'),
            projectId: $this->projectId('Internal Wiki'),
        );

        $entry = $this->activity->forEntity('project', $this->projectId('Internal Wiki'))[0];

        $this->assertNull($entry['old_values']);
        $this->assertNull($entry['new_values']);
        $this->assertNotNull($entry['created_at']);
    }

    public function testDiffReportsOnlyChangedFields(): void
    {
        [$old, $new] = ActivityLogModel::diff(
            ['status' => 'todo', 'priority' => 'low', 'title' => 'Same'],
            ['status' => 'review', 'priority' => 'low', 'title' => 'Same'],
        );

        $this->assertSame(['status' => 'todo'], $old);
        $this->assertSame(['status' => 'review'], $new);
    }

    public function testDiffIgnoresFieldsMissingFromTheOriginal(): void
    {
        [$old, $new] = ActivityLogModel::diff(
            ['status' => 'todo'],
            ['status' => 'todo', 'unrelated' => 'value'],
        );

        $this->assertSame([], $old);
        $this->assertSame([], $new);
    }

    public function testDiffTreatsIntegerAndStringFormsOfAValueAsEqual(): void
    {
        // Form input arrives as strings while the stored row holds integers.
        [$old, $new] = ActivityLogModel::diff(['position' => 3], ['position' => '3']);

        $this->assertSame([], $old);
        $this->assertSame([], $new);
    }

    public function testRecentForProjectIsNewestFirstWithTheActorsUsername(): void
    {
        $entries = $this->activity->recentForProject($this->projectId('Website Redesign'));

        $this->assertCount(6, $entries);
        // The most recent seeded entry is the status change nine days ago.
        $this->assertSame('developer', $entries[0]['username']);
        $this->assertSame(ActivityLogModel::ACTION_UPDATE, $entries[0]['action']);
        // The oldest is the project being created thirty days ago.
        $this->assertSame(ActivityLogModel::ACTION_CREATE, end($entries)['action']);
    }

    public function testRecentForProjectRespectsTheLimit(): void
    {
        $this->assertCount(2, $this->activity->recentForProject($this->projectId('Website Redesign'), 2));
    }

    public function testForEntityReturnsTheHistoryOfASingleTask(): void
    {
        $entries = $this->activity->forEntity('task', $this->taskId('Build authentication'));

        $this->assertCount(2, $entries);
        $this->assertSame(['update', 'create'], array_column($entries, 'action'));
    }

    public function testTheAuditTrailSurvivesHardDeletionOfItsProject(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $before    = count($this->activity->recentForProject($projectId));

        $this->assertSame(6, $before);

        // Purge rather than soft delete, so the foreign key actually fires.
        model(ProjectModel::class)->delete($projectId, true);

        $this->dontSeeInDatabase('projects', ['id' => $projectId]);

        // SET NULL, not CASCADE: the entries are still here, detached from the
        // project but keeping their description and value diff.
        $survivors = $this->activity
            ->where('project_id', null)
            ->where('entity_type', 'task')
            ->findAll();

        $this->assertNotSame([], $survivors);
        $this->assertNotNull($survivors[0]['description']);
    }

    public function testValidationRejectsAMissingAction(): void
    {
        $result = $this->activity->insert([
            'entity_type' => 'task',
            'entity_id'   => $this->taskId('Create API'),
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('action', $this->activity->errors());
    }
}
