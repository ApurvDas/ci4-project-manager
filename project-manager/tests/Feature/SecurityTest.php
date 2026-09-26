<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ProjectModel;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\Security\Exceptions\SecurityException;
use Tests\Support\FeatureTestCase;

/**
 * Cross-cutting security behaviour.
 *
 * The per-feature tests already cover who may do what. These cover the classes
 * of problem that are easy to reintroduce anywhere: output escaping, CSRF,
 * insecure direct object references, and mass assignment.
 *
 * @internal
 */
final class SecurityTest extends FeatureTestCase
{
    private function websiteId(): int
    {
        return $this->projectId('Website Redesign');
    }

    public function testProjectNamesAreEscapedOnOutput(): void
    {
        $projectId = (int) model(ProjectModel::class)->insert([
            'owner_id' => $this->userId('admin'),
            'name'     => '<script>alert(1)</script>',
            'status'   => 'active',
            'priority' => 'low',
        ], true);

        $this->db->table('project_members')->insert([
            'project_id' => $projectId,
            'user_id'    => $this->userId('admin'),
            'role'       => 'owner',
        ]);

        $body = (string) $this->signIn('admin')->get('projects')->getBody();

        $this->assertStringNotContainsString('<script>alert(1)</script>', $body);
        $this->assertStringContainsString('&lt;script&gt;', $body);
    }

    public function testTaskContentIsEscapedOnOutput(): void
    {
        $projectId = $this->websiteId();

        $this->signIn('admin')->submit("projects/{$projectId}/tasks", [
            'title'       => '<img src=x onerror=alert(1)>',
            'description' => '<script>steal()</script>',
            'status'      => 'todo',
            'priority'    => 'low',
        ]);

        $taskId = $this->taskId('<img src=x onerror=alert(1)>');
        $body   = (string) $this->signIn('admin')->get("projects/{$projectId}/tasks/{$taskId}")->getBody();

        $this->assertStringNotContainsString('<img src=x onerror=alert(1)>', $body);
        $this->assertStringNotContainsString('<script>steal()</script>', $body);
        $this->assertStringContainsString('&lt;img', $body);
    }

    public function testCommentsAreEscapedOnOutput(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Build authentication');

        $this->signIn('admin')->submit("projects/{$projectId}/tasks/{$taskId}/comments", [
            'comment' => '<script>alert("xss")</script>',
        ]);

        $body = (string) $this->signIn('admin')->get("projects/{$projectId}/tasks/{$taskId}")->getBody();

        $this->assertStringNotContainsString('<script>alert("xss")</script>', $body);
    }

    /**
     * Every state-changing endpoint must sit behind the CSRF filter.
     */
    public function testStateChangingEndpointsRejectRequestsWithoutAToken(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Build authentication');

        $endpoints = [
            'projects',
            "projects/{$projectId}",
            "projects/{$projectId}/delete",
            "projects/{$projectId}/tasks",
            "projects/{$projectId}/tasks/{$taskId}/delete",
            "projects/{$projectId}/tasks/{$taskId}/comments",
            "projects/{$projectId}/board/{$taskId}/move",
            'notifications/read-all',
        ];

        $this->signIn('admin');

        $refused = 0;

        foreach ($endpoints as $endpoint) {
            try {
                // post(), not submit(): no CSRF token is attached.
                $this->post($endpoint, ['name' => 'x', 'title' => 'x', 'status' => 'todo']);

                $this->fail($endpoint . ' accepted a request with no CSRF token.');
            } catch (SecurityException) {
                $refused++;
            }
        }

        $this->assertSame(count($endpoints), $refused);
    }

    /**
     * Insecure direct object reference: knowing an id must never be enough.
     */
    public function testAProjectIdAloneDoesNotGrantAccess(): void
    {
        $this->expectException(PageNotFoundException::class);

        // designer is a real user, signed in, guessing a real project id.
        $this->signIn('designer')->get('projects/' . $this->projectId('Internal Wiki'));
    }

    public function testATaskIdAloneDoesNotGrantAccess(): void
    {
        $this->expectException(PageNotFoundException::class);

        $this->signIn('designer')->get(
            'projects/' . $this->projectId('Mobile Application') . '/tasks/' . $this->taskId('Set up CI pipeline'),
        );
    }

    public function testATaskCannotBeReachedThroughAProjectItDoesNotBelongTo(): void
    {
        // The user is a member of the project in the URL, and the task id is
        // real — but the task belongs to a different project.
        $this->expectException(PageNotFoundException::class);

        $this->signIn('admin')->get(
            'projects/' . $this->websiteId() . '/tasks/' . $this->taskId('Set up CI pipeline'),
        );
    }

    public function testACommentCannotBeDeletedThroughTheWrongTask(): void
    {
        $projectId = $this->websiteId();

        $commentId = (int) $this->db->table('task_comments')
            ->where('task_id', $this->taskId('Design homepage'))
            ->get()
            ->getRowArray()['id'];

        // Correct project, but the comment belongs to a different task.
        $this->signIn('admin')->submit(
            "projects/{$projectId}/tasks/" . $this->taskId('Build authentication') . "/comments/{$commentId}/delete",
        );

        $this->seeInDatabase('task_comments', ['id' => $commentId, 'deleted_at' => null]);
    }

    public function testATagCannotBeDeletedThroughAnotherProject(): void
    {
        $foreignTagId = (int) $this->db->table('tags')
            ->where('project_id', $this->projectId('Mobile Application'))
            ->get()
            ->getRowArray()['id'];

        // admin owns Website Redesign but is not in Mobile Application.
        $this->signIn('admin')->submit(
            'projects/' . $this->websiteId() . "/tags/{$foreignTagId}/delete",
        );

        $this->seeInDatabase('tags', ['id' => $foreignTagId]);
    }

    /**
     * Mass assignment: posting a field the form does not offer must not change
     * it, because the models declare allowedFields.
     */
    public function testOwnershipCannotBeReassignedByPostingAnExtraField(): void
    {
        $projectId = $this->websiteId();

        $this->signIn('manager')->submit("projects/{$projectId}", [
            'name'     => 'Website Redesign',
            'status'   => 'active',
            'priority' => 'high',
            'owner_id' => $this->userId('manager'),
        ]);

        // Still owned by admin.
        $this->seeInDatabase('projects', [
            'id'       => $projectId,
            'owner_id' => $this->userId('admin'),
        ]);
    }

    public function testTaskAuthorshipCannotBeForgedByPostingAnExtraField(): void
    {
        $projectId = $this->websiteId();

        $this->signIn('designer')->submit("projects/{$projectId}/tasks", [
            'title'      => 'Honest task',
            'status'     => 'todo',
            'priority'   => 'low',
            'created_by' => $this->userId('admin'),
            'project_id' => $this->projectId('Marketing Campaign'),
        ]);

        // created_by and project_id are set by the server, not the form.
        $this->seeInDatabase('tasks', [
            'title'      => 'Honest task',
            'created_by' => $this->userId('designer'),
            'project_id' => $projectId,
        ]);
    }

    public function testNotificationsOfOtherUsersAreNotReadable(): void
    {
        $body = (string) $this->signIn('admin')->get('notifications')->getBody();

        // A message addressed to developer only.
        $this->assertStringNotContainsString('Build authentication is due in 2 days', $body);
    }

    public function testSessionIsRequiredForEveryWriteEndpoint(): void
    {
        // Signed out: the session filter must intercept before anything else.
        $result = $this->submit('projects', [
            'name'     => 'Guest project',
            'status'   => 'planning',
            'priority' => 'low',
        ]);

        $result->assertRedirect();
        $this->dontSeeInDatabase('projects', ['name' => 'Guest project']);
    }
}
