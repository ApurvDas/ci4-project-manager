<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Exceptions\PageNotFoundException;
use Tests\Support\FeatureTestCase;

/**
 * Task CRUD, assignment and the authorisation around it.
 *
 * Website Redesign roles: admin owns it, manager manages it, designer and
 * developer are members, tester is a viewer.
 *
 * @internal
 */
final class TasksTest extends FeatureTestCase
{
    private function websiteId(): int
    {
        return $this->projectId('Website Redesign');
    }

    public function testMemberSeesTheTaskList(): void
    {
        $result = $this->signIn('designer')->get('projects/' . $this->websiteId() . '/tasks');

        $result->assertOK();
        $result->assertSee('Build authentication');
        $result->assertSee('Accessibility audit');
    }

    public function testNonMemberCannotSeeTheTaskList(): void
    {
        $this->expectException(PageNotFoundException::class);

        $this->signIn('designer')->get('projects/' . $this->projectId('Mobile Application') . '/tasks');
    }

    public function testTaskFromAnotherProjectIsNotReachableThroughThisOne(): void
    {
        // A real task id, but not one belonging to Website Redesign.
        $foreignTaskId = $this->taskId('Set up CI pipeline');

        $this->expectException(PageNotFoundException::class);

        $this->signIn('admin')->get('projects/' . $this->websiteId() . '/tasks/' . $foreignTaskId);
    }

    public function testMemberCanCreateATask(): void
    {
        $projectId = $this->websiteId();

        $result = $this->signIn('designer')->submit('projects/' . $projectId . '/tasks', [
            'title'    => 'Write release notes',
            'status'   => 'todo',
            'priority' => 'medium',
        ]);

        $result->assertRedirect();
        $this->seeInDatabase('tasks', [
            'project_id' => $projectId,
            'title'      => 'Write release notes',
            'created_by' => $this->userId('designer'),
        ]);
    }

    public function testViewerCannotCreateATask(): void
    {
        $result = $this->signIn('tester')->submit('projects/' . $this->websiteId() . '/tasks', [
            'title'    => 'Sneaky task',
            'status'   => 'todo',
            'priority' => 'low',
        ]);

        $result->assertRedirect();
        $this->dontSeeInDatabase('tasks', ['title' => 'Sneaky task']);
    }

    public function testViewerCannotOpenTheNewTaskForm(): void
    {
        $result = $this->signIn('tester')->get('projects/' . $this->websiteId() . '/tasks/new');

        $result->assertRedirect();
    }

    public function testCreatingATaskAppendsItToItsColumn(): void
    {
        $projectId = $this->websiteId();

        $this->signIn('designer')->submit('projects/' . $projectId . '/tasks', [
            'title'    => 'Third todo',
            'status'   => 'todo',
            'priority' => 'low',
        ]);

        // todo already held positions 0 and 1.
        $this->seeInDatabase('tasks', ['title' => 'Third todo', 'position' => 2]);
    }

    public function testCreatingATaskWithAssigneesAndTags(): void
    {
        $projectId  = $this->websiteId();
        $developerId = $this->userId('developer');

        $tagId = (int) $this->db->table('tags')
            ->where('project_id', $projectId)
            ->where('name', 'Backend')
            ->get()
            ->getRowArray()['id'];

        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks', [
            'title'     => 'Wire up the API',
            'status'    => 'todo',
            'priority'  => 'high',
            'assignees' => [$developerId],
            'tags'      => [$tagId],
        ]);

        $taskId = $this->taskId('Wire up the API');

        $this->seeInDatabase('task_assignees', ['task_id' => $taskId, 'user_id' => $developerId]);
        $this->seeInDatabase('task_tags', ['task_id' => $taskId, 'tag_id' => $tagId]);
    }

    public function testAssigningSomeoneNotifiesThem(): void
    {
        $projectId   = $this->websiteId();
        $developerId = $this->userId('developer');
        $before      = $this->db->table('notifications')->where('user_id', $developerId)->countAllResults();

        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks', [
            'title'     => 'Notify me',
            'status'    => 'todo',
            'priority'  => 'low',
            'assignees' => [$developerId],
        ]);

        $this->assertSame(
            $before + 1,
            $this->db->table('notifications')->where('user_id', $developerId)->countAllResults(),
        );
    }

    public function testAssigningYourselfDoesNotNotifyYou(): void
    {
        $projectId = $this->websiteId();
        $adminId   = $this->userId('admin');
        $before    = $this->db->table('notifications')->where('user_id', $adminId)->countAllResults();

        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks', [
            'title'     => 'My own task',
            'status'    => 'todo',
            'priority'  => 'low',
            'assignees' => [$adminId],
        ]);

        $this->assertSame(
            $before,
            $this->db->table('notifications')->where('user_id', $adminId)->countAllResults(),
        );
    }

    public function testCreatingATaskRecordsActivity(): void
    {
        $projectId = $this->websiteId();

        $this->signIn('designer')->submit('projects/' . $projectId . '/tasks', [
            'title'    => 'Logged task',
            'status'   => 'todo',
            'priority' => 'low',
        ]);

        $this->seeInDatabase('activity_logs', [
            'project_id'  => $projectId,
            'entity_type' => 'task',
            'action'      => 'create',
            'entity_id'   => $this->taskId('Logged task'),
        ]);
    }

    public function testInvalidTaskIsRejected(): void
    {
        $projectId = $this->websiteId();
        $before    = $this->db->table('tasks')->countAllResults();

        $result = $this->signIn('designer')->submit('projects/' . $projectId . '/tasks', [
            'title'    => 'ab',
            'status'   => 'todo',
            'priority' => 'low',
        ]);

        $result->assertRedirect();
        $this->assertSame($before, $this->db->table('tasks')->countAllResults());
    }

    public function testUpdatingReplacesTheAssigneeSet(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Build authentication');
        $adminId   = $this->userId('admin');

        // Seeded with developer and tester; replace them with admin alone.
        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks/' . $taskId, [
            'title'     => 'Build authentication',
            'status'    => 'in_progress',
            'priority'  => 'critical',
            'assignees' => [$adminId],
        ]);

        $this->seeInDatabase('task_assignees', ['task_id' => $taskId, 'user_id' => $adminId]);
        $this->dontSeeInDatabase('task_assignees', [
            'task_id' => $taskId,
            'user_id' => $this->userId('developer'),
        ]);
    }

    public function testCompletingATaskStampsCompletedAt(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Create API');

        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks/' . $taskId, [
            'title'    => 'Create API',
            'status'   => 'completed',
            'priority' => 'high',
        ]);

        $task = $this->db->table('tasks')->where('id', $taskId)->get()->getRowArray();

        $this->assertSame('completed', $task['status']);
        $this->assertNotNull($task['completed_at']);
    }

    public function testReopeningATaskClearsCompletedAt(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Design homepage');

        $this->signIn('admin')->submit('projects/' . $projectId . '/tasks/' . $taskId, [
            'title'    => 'Design homepage',
            'status'   => 'todo',
            'priority' => 'high',
        ]);

        $task = $this->db->table('tasks')->where('id', $taskId)->get()->getRowArray();

        $this->assertSame('todo', $task['status']);
        $this->assertNull($task['completed_at']);
    }

    public function testViewerCannotUpdateATask(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Create API');

        $this->signIn('tester')->submit('projects/' . $projectId . '/tasks/' . $taskId, [
            'title'    => 'Renamed by a viewer',
            'status'   => 'todo',
            'priority' => 'low',
        ]);

        $this->dontSeeInDatabase('tasks', ['title' => 'Renamed by a viewer']);
    }

    public function testCreatorCanDeleteTheirOwnTask(): void
    {
        $projectId = $this->websiteId();

        // manager created Create API in the seed data.
        $taskId = $this->taskId('Create API');

        $this->signIn('manager')->submit('projects/' . $projectId . '/tasks/' . $taskId . '/delete');

        $this->dontSeeInDatabase('tasks', ['id' => $taskId, 'deleted_at' => null]);
    }

    public function testPlainMemberCannotDeleteSomeoneElsesTask(): void
    {
        $projectId = $this->websiteId();
        // Created by admin.
        $taskId = $this->taskId('Build authentication');

        $this->signIn('designer')->submit('projects/' . $projectId . '/tasks/' . $taskId . '/delete');

        $this->seeInDatabase('tasks', ['id' => $taskId, 'deleted_at' => null]);
    }

    public function testManagerCanDeleteAnyTaskInTheProject(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Build authentication');

        $this->signIn('manager')->submit('projects/' . $projectId . '/tasks/' . $taskId . '/delete');

        $this->dontSeeInDatabase('tasks', ['id' => $taskId, 'deleted_at' => null]);
    }

    public function testTaskDetailShowsCommentsChecklistsAndAssignees(): void
    {
        $result = $this->signIn('tester')
            ->get('projects/' . $this->websiteId() . '/tasks/' . $this->taskId('Build authentication'));

        $result->assertOK();
        $result->assertSee('Authentication');        // checklist title
        $result->assertSee('Forgot password');       // checklist item
        $result->assertSee('developer');             // assignee
    }
}
