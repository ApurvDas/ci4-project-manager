<?php

declare(strict_types=1);

namespace Tests\Feature;

use CodeIgniter\Exceptions\PageNotFoundException;
use Tests\Support\FeatureTestCase;

/**
 * The Kanban board and its move endpoint.
 *
 * Seeded Website Redesign columns:
 *   todo         Migrate legacy content (0), Deploy application (1)
 *   in_progress  Build authentication (0), Create API (1)
 *   review       Accessibility audit (0)
 *   completed    Design homepage (0)
 *
 * @internal
 */
final class BoardTest extends FeatureTestCase
{
    private function websiteId(): int
    {
        return $this->projectId('Website Redesign');
    }

    private function positionOf(string $title): int
    {
        return (int) $this->db->table('tasks')
            ->select('position')
            ->where('id', $this->taskId($title))
            ->get()
            ->getRowArray()['position'];
    }

    private function statusOf(string $title): string
    {
        return (string) $this->db->table('tasks')
            ->select('status')
            ->where('id', $this->taskId($title))
            ->get()
            ->getRowArray()['status'];
    }

    public function testBoardRendersEveryColumn(): void
    {
        $result = $this->signIn('designer')->get('projects/' . $this->websiteId() . '/board');

        $result->assertOK();
        $result->assertSee('Todo');
        $result->assertSee('In progress');
        $result->assertSee('Review');
        $result->assertSee('Completed');
        $result->assertSee('Build authentication');
    }

    public function testNonMemberCannotSeeTheBoard(): void
    {
        $this->expectException(PageNotFoundException::class);

        $this->signIn('designer')->get('projects/' . $this->projectId('Mobile Application') . '/board');
    }

    public function testViewerIsToldTheBoardIsReadOnly(): void
    {
        $result = $this->signIn('tester')->get('projects/' . $this->websiteId() . '/board');

        $result->assertOK();
        $result->assertSee('read-only access');
    }

    public function testMemberCanMoveACardToAnotherColumn(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $result = $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'in_progress', 'position' => 0],
        );

        $result->assertOK();
        $this->assertSame('in_progress', $this->statusOf('Deploy application'));
    }

    public function testMovingResequencesBothColumns(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'in_progress', 'position' => 0],
        );

        // Destination column renumbers from the insertion point.
        $this->assertSame(0, $this->positionOf('Deploy application'));
        $this->assertSame(1, $this->positionOf('Build authentication'));
        $this->assertSame(2, $this->positionOf('Create API'));

        // The column it left closes its gap.
        $this->assertSame(0, $this->positionOf('Migrate legacy content'));
    }

    public function testReorderingWithinAColumn(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Create API');

        // Create API is second in in_progress; move it to the front.
        $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'in_progress', 'position' => 0],
        );

        $this->assertSame(0, $this->positionOf('Create API'));
        $this->assertSame(1, $this->positionOf('Build authentication'));
    }

    public function testMovingToCompletedStampsCompletedAt(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Create API');

        $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'completed', 'position' => 0],
        );

        $task = $this->db->table('tasks')->where('id', $taskId)->get()->getRowArray();

        $this->assertNotNull($task['completed_at']);
    }

    public function testViewerCannotMoveACard(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $result = $this->signIn('tester')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'in_progress', 'position' => 0],
        );

        $result->assertStatus(403);
        // Unchanged in the database, whatever the browser was told.
        $this->assertSame('todo', $this->statusOf('Deploy application'));
    }

    public function testAnUnknownColumnIsRejected(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $result = $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'abandoned', 'position' => 0],
        );

        $result->assertStatus(422);
        $this->assertSame('todo', $this->statusOf('Deploy application'));
    }

    public function testATaskFromAnotherProjectCannotBeMovedThroughThisBoard(): void
    {
        $projectId     = $this->websiteId();
        $foreignTaskId = $this->taskId('Set up CI pipeline');

        try {
            $this->signIn('admin')->submit(
                "projects/{$projectId}/board/{$foreignTaskId}/move",
                ['status' => 'completed', 'position' => 0],
            );

            $this->fail('A task from another project must not be movable here.');
        } catch (PageNotFoundException) {
            // Expected.
        }

        $this->assertSame('todo', $this->statusOf('Set up CI pipeline'));
    }

    public function testMovingBetweenColumnsRecordsActivity(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'review', 'position' => 0],
        );

        $this->seeInDatabase('activity_logs', [
            'project_id'  => $projectId,
            'entity_type' => 'task',
            'entity_id'   => $taskId,
            'user_id'     => $this->userId('designer'),
        ]);
    }

    public function testReorderingWithinAColumnDoesNotSpamTheHistory(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Create API');

        $before = $this->db->table('activity_logs')->where('entity_id', $taskId)->countAllResults();

        $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'in_progress', 'position' => 0],
        );

        // Same column: nothing meaningful changed, so nothing is logged.
        $this->assertSame(
            $before,
            $this->db->table('activity_logs')->where('entity_id', $taskId)->countAllResults(),
        );
    }

    public function testTheMoveResponseCarriesAFreshCsrfToken(): void
    {
        $projectId = $this->websiteId();
        $taskId    = $this->taskId('Deploy application');

        $result = $this->signIn('designer')->submit(
            "projects/{$projectId}/board/{$taskId}/move",
            ['status' => 'review', 'position' => 0],
        );

        $payload = json_decode($result->getJSON(), true);

        // Tokens rotate per request, so the board needs the replacement or its
        // next drag would be rejected.
        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('csrf', $payload);
        $this->assertNotEmpty($payload['csrf']['hash']);
    }
}
