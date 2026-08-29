<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\ProjectModel;
use App\Models\TaskModel;
use Tests\Support\ModelTestCase;

/**
 * @internal
 */
final class TaskModelTest extends ModelTestCase
{
    private TaskModel $tasks;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tasks = model(TaskModel::class);
    }

    public function testBoardAlwaysContainsEveryColumn(): void
    {
        // Marketing Campaign has no todo-only... it has review and todo tasks,
        // but no in_progress or completed ones.
        $board = $this->tasks->boardFor($this->projectId('Marketing Campaign'));

        $this->assertSame(TaskModel::STATUSES, array_keys($board));
        $this->assertSame([], $board['in_progress']);
        $this->assertSame([], $board['completed']);
    }

    public function testBoardGroupsTasksByStatus(): void
    {
        $board = $this->tasks->boardFor($this->projectId('Website Redesign'));

        $this->assertCount(2, $board['todo']);
        $this->assertCount(2, $board['in_progress']);
        $this->assertCount(1, $board['review']);
        $this->assertCount(1, $board['completed']);
    }

    public function testBoardOrdersEachColumnByPosition(): void
    {
        $board = $this->tasks->boardFor($this->projectId('Website Redesign'));

        $this->assertSame(
            ['Migrate legacy content', 'Deploy application'],
            array_column($board['todo'], 'title'),
        );

        $this->assertSame([0, 1], array_map('intval', array_column($board['todo'], 'position')));
    }

    public function testPositionsRestartWithinEachColumn(): void
    {
        $board = $this->tasks->boardFor($this->projectId('Website Redesign'));

        $this->assertSame(0, (int) $board['todo'][0]['position']);
        $this->assertSame(0, (int) $board['in_progress'][0]['position']);
        $this->assertSame(0, (int) $board['review'][0]['position']);
    }

    public function testNextPositionContinuesTheColumn(): void
    {
        $projectId = $this->projectId('Website Redesign');

        // todo holds positions 0 and 1.
        $this->assertSame(2, $this->tasks->nextPosition($projectId, 'todo'));
        // review holds a single task at position 0.
        $this->assertSame(1, $this->tasks->nextPosition($projectId, 'review'));
    }

    public function testNextPositionIsZeroForAnEmptyColumn(): void
    {
        $this->assertSame(0, $this->tasks->nextPosition(
            $this->projectId('Marketing Campaign'),
            'completed',
        ));
    }

    public function testDashboardCountsForAnAssignee(): void
    {
        // tester is assigned four tasks: one overdue, one due today,
        // and two upcoming.
        $counts = $this->tasks->dashboardCountsFor($this->userId('tester'));

        $this->assertSame(4, $counts['assigned']);
        $this->assertSame(1, $counts['overdue']);
        $this->assertSame(1, $counts['due_today']);
        $this->assertSame(0, $counts['completed']);
    }

    public function testCompletedTasksAreNeverCountedAsOverdue(): void
    {
        // developer's two completed wiki tasks are long past their due date.
        $this->assertSame(0, $this->tasks->countOverdueFor($this->userId('developer')));
        $this->assertSame(2, $this->tasks->countCompletedFor($this->userId('developer')));
    }

    public function testAssignedTasksExcludeSoftDeletedProjects(): void
    {
        $userId = $this->userId('developer');
        $before = $this->tasks->countAssignedTo($userId);

        model(ProjectModel::class)->delete($this->projectId('Internal Wiki'));

        // The two wiki tasks drop out even though the tasks themselves were
        // not touched.
        $this->assertSame($before - 2, $this->tasks->countAssignedTo($userId));
    }

    public function testAssignedToCanBeLimited(): void
    {
        $this->assertCount(2, $this->tasks->assignedTo($this->userId('developer'), 2));
    }

    public function testStatusCountsForAProject(): void
    {
        $counts = $this->tasks->statusCountsFor($this->projectId('Website Redesign'));

        $this->assertSame(TaskModel::STATUSES, array_keys($counts));
        $this->assertSame(2, $counts['todo']);
        $this->assertSame(1, $counts['review']);
    }

    public function testSoftDeletedTasksLeaveTheBoard(): void
    {
        $projectId = $this->projectId('Website Redesign');

        $this->tasks->delete($this->taskId('Deploy application'));

        $this->assertCount(1, $this->tasks->boardFor($projectId)['todo']);
        $this->seeInDatabase('tasks', ['title' => 'Deploy application']);
    }

    public function testInvalidStatusIsRejected(): void
    {
        $result = $this->tasks->insert([
            'project_id' => $this->projectId('Website Redesign'),
            'created_by' => $this->userId('admin'),
            'title'      => 'Broken task',
            'status'     => 'blocked',
            'priority'   => 'low',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('status', $this->tasks->errors());
    }

    public function testInvalidDueDateIsRejected(): void
    {
        $result = $this->tasks->insert([
            'project_id' => $this->projectId('Website Redesign'),
            'created_by' => $this->userId('admin'),
            'title'      => 'Broken date',
            'status'     => 'todo',
            'priority'   => 'low',
            'due_date'   => '31/12/2026',
        ]);

        $this->assertFalse($result);
        $this->assertArrayHasKey('due_date', $this->tasks->errors());
    }
}
