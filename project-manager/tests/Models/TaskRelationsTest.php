<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\TaskAssigneeModel;
use App\Models\TaskChecklistItemModel;
use App\Models\TaskChecklistModel;
use App\Models\TaskCommentModel;
use App\Models\TaskTagModel;
use Tests\Support\ModelTestCase;

/**
 * Covers the models that hang off a task: assignees, tags, checklists,
 * checklist items and comments.
 *
 * @internal
 */
final class TaskRelationsTest extends ModelTestCase
{
    public function testAssigneesAreListedWithUsernames(): void
    {
        $assignees = model(TaskAssigneeModel::class)->forTask($this->taskId('Build authentication'));

        $this->assertSame(['developer', 'tester'], array_column($assignees, 'username'));
    }

    public function testSyncAddsAndRemovesOnlyTheDifference(): void
    {
        $assignees = model(TaskAssigneeModel::class);
        $taskId    = $this->taskId('Build authentication');

        $result = $assignees->syncForTask($taskId, [
            $this->userId('developer'),
            $this->userId('admin'),
        ]);

        $this->assertSame([$this->userId('admin')], $result['added']);
        $this->assertSame([$this->userId('tester')], $result['removed']);
        $this->assertSame(['admin', 'developer'], array_column($assignees->forTask($taskId), 'username'));
    }

    public function testSyncWithAnUnchangedSetTouchesNothing(): void
    {
        $assignees = model(TaskAssigneeModel::class);
        $taskId    = $this->taskId('Build authentication');

        $before = $assignees->forTask($taskId);
        $result = $assignees->syncForTask($taskId, $assignees->userIdsFor($taskId));

        $this->assertSame([], $result['added']);
        $this->assertSame([], $result['removed']);
        // assigned_at must survive, so notifications keyed off it are not re-sent.
        $this->assertSame(
            array_column($before, 'assigned_at'),
            array_column($assignees->forTask($taskId), 'assigned_at'),
        );
    }

    public function testSyncWithAnEmptySetRemovesEveryAssignee(): void
    {
        $assignees = model(TaskAssigneeModel::class);
        $taskId    = $this->taskId('Build authentication');

        $assignees->syncForTask($taskId, []);

        $this->assertSame([], $assignees->forTask($taskId));
    }

    public function testSyncIgnoresDuplicateUserIds(): void
    {
        $assignees = model(TaskAssigneeModel::class);
        $taskId    = $this->taskId('Create API');
        $userId    = $this->userId('admin');

        $assignees->syncForTask($taskId, [$userId, $userId]);

        $this->assertCount(1, $assignees->forTask($taskId));
    }

    public function testTagsForATask(): void
    {
        $tags = model(TaskTagModel::class)->forTask($this->taskId('Build authentication'));

        $this->assertSame(['Backend', 'Urgent'], array_column($tags, 'name'));
        $this->assertMatchesRegularExpression('/^#[0-9A-Fa-f]{6}$/', $tags[0]['color']);
    }

    public function testTagsForManyTasksAreGroupedByTaskId(): void
    {
        $authId = $this->taskId('Build authentication');
        $apiId  = $this->taskId('Create API');

        $grouped = model(TaskTagModel::class)->forTasks([$authId, $apiId]);

        $this->assertSame(['Backend', 'Urgent'], array_column($grouped[$authId], 'name'));
        $this->assertSame(['Backend'], array_column($grouped[$apiId], 'name'));
        $this->assertArrayNotHasKey('task_id', $grouped[$apiId][0]);
    }

    public function testTagsForNoTasksReturnsAnEmptyArray(): void
    {
        $this->assertSame([], model(TaskTagModel::class)->forTasks([]));
    }

    public function testSyncingTagsReplacesTheWholeSet(): void
    {
        $taskTags = model(TaskTagModel::class);
        $taskId   = $this->taskId('Create API');

        $urgentId = (int) $this->db->table('tags')
            ->select('id')
            ->where('name', 'Urgent')
            ->get()
            ->getRowArray()['id'];

        $taskTags->syncForTask($taskId, [$urgentId]);

        $this->assertSame(['Urgent'], array_column($taskTags->forTask($taskId), 'name'));
    }

    public function testChecklistsLoadWithTheirItemsInOrder(): void
    {
        $checklists = model(TaskChecklistModel::class)
            ->forTaskWithItems($this->taskId('Build authentication'));

        $this->assertCount(1, $checklists);
        $this->assertSame('Authentication', $checklists[0]['title']);
        $this->assertSame(
            ['Create login page', 'Add validation', 'Forgot password', 'Email verification'],
            array_column($checklists[0]['items'], 'content'),
        );
    }

    public function testChecklistItemsCastCompletionToBoolean(): void
    {
        $checklists = model(TaskChecklistModel::class)
            ->forTaskWithItems($this->taskId('Build authentication'));

        $items = $checklists[0]['items'];

        $this->assertTrue($items[0]['is_completed']);
        $this->assertFalse($items[2]['is_completed']);
    }

    public function testChecklistProgressForATask(): void
    {
        // Two of the four authentication items are ticked.
        $progress = model(TaskChecklistItemModel::class)
            ->progressForTask($this->taskId('Build authentication'));

        $this->assertSame(2, $progress['completed']);
        $this->assertSame(4, $progress['total']);
        $this->assertSame(50, $progress['percent']);
    }

    public function testChecklistProgressForATaskWithoutChecklists(): void
    {
        $progress = model(TaskChecklistItemModel::class)
            ->progressForTask($this->taskId('Create API'));

        $this->assertSame(['completed' => 0, 'total' => 0, 'percent' => 0], $progress);
    }

    public function testTickingAnItemStampsCompletedAt(): void
    {
        $items = model(TaskChecklistItemModel::class);

        $itemId = (int) $this->db->table('task_checklist_items')
            ->select('id')
            ->where('content', 'Forgot password')
            ->get()
            ->getRowArray()['id'];

        $items->setCompleted($itemId, true);

        $item = $items->find($itemId);
        $this->assertTrue($item['is_completed']);
        $this->assertNotNull($item['completed_at']);
    }

    public function testUntickingAnItemClearsCompletedAt(): void
    {
        $items = model(TaskChecklistItemModel::class);

        $itemId = (int) $this->db->table('task_checklist_items')
            ->select('id')
            ->where('content', 'Add validation')
            ->get()
            ->getRowArray()['id'];

        $items->setCompleted($itemId, false);

        $item = $items->find($itemId);
        $this->assertFalse($item['is_completed']);
        $this->assertNull($item['completed_at']);
    }

    public function testNextChecklistItemPosition(): void
    {
        $checklistId = (int) $this->db->table('task_checklists')
            ->select('id')
            ->where('title', 'Authentication')
            ->get()
            ->getRowArray()['id'];

        $this->assertSame(4, model(TaskChecklistItemModel::class)->nextPosition($checklistId));
    }

    public function testCommentsAreReturnedOldestFirstWithAuthors(): void
    {
        $comments = model(TaskCommentModel::class)->forTask($this->taskId('Build authentication'));

        $this->assertSame(['manager', 'developer'], array_column($comments, 'username'));
    }

    public function testSoftDeletedCommentsAreExcluded(): void
    {
        $comments = model(TaskCommentModel::class);
        $taskId   = $this->taskId('Build authentication');

        $comments->delete($comments->forTask($taskId)[0]['id']);

        $this->assertSame(1, $comments->countForTask($taskId));
    }

    public function testEmptyCommentIsRejected(): void
    {
        $comments = model(TaskCommentModel::class);

        $result = $comments->insert([
            'task_id' => $this->taskId('Create API'),
            'user_id' => $this->userId('admin'),
            'comment' => '',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('comment', $comments->errors());
    }
}
