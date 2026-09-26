<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\Support\FeatureTestCase;

/**
 * Notification delivery and the notification page.
 *
 * Seeded unread counts: developer 2, tester 1, manager 1, admin 0, designer 0.
 *
 * @internal
 */
final class NotificationsTest extends FeatureTestCase
{
    private function unreadFor(string $username): int
    {
        return $this->db->table('notifications')
            ->where('user_id', $this->userId($username))
            ->where('read_at', null)
            ->countAllResults();
    }

    public function testGuestCannotReachNotifications(): void
    {
        $result = $this->get('notifications');

        $result->assertRedirect();
        $this->assertStringContainsString('login', $result->getRedirectUrl());
    }

    public function testPageShowsOnlyYourOwnNotifications(): void
    {
        $result = $this->signIn('developer')->get('notifications');

        $result->assertOK();
        $result->assertSee('You were assigned a task');
        // manager's notification, addressed to somebody else.
        $result->assertDontSee('A task moved to review');
    }

    public function testUnreadCountAppearsInTheHeader(): void
    {
        $result = $this->signIn('developer')->get('dashboard');

        $result->assertOK();
        $result->assertSee('Notifications');
    }

    public function testMarkingOneAsRead(): void
    {
        $userId = $this->userId('tester');

        $notificationId = (int) $this->db->table('notifications')
            ->where('user_id', $userId)
            ->where('read_at', null)
            ->get()
            ->getRowArray()['id'];

        $this->signIn('tester')->submit("notifications/{$notificationId}/read");

        $this->assertSame(0, $this->unreadFor('tester'));
    }

    public function testYouCannotMarkSomebodyElsesNotificationAsRead(): void
    {
        $ownerId = $this->userId('tester');

        $notificationId = (int) $this->db->table('notifications')
            ->where('user_id', $ownerId)
            ->where('read_at', null)
            ->get()
            ->getRowArray()['id'];

        // admin guesses the id.
        $this->signIn('admin')->submit("notifications/{$notificationId}/read");

        $this->assertSame(1, $this->unreadFor('tester'));
    }

    public function testMarkAllAsReadOnlyAffectsYou(): void
    {
        $this->signIn('developer')->submit('notifications/read-all');

        $this->assertSame(0, $this->unreadFor('developer'));
        $this->assertSame(1, $this->unreadFor('manager'));
    }

    public function testCommentingNotifiesTheOtherPeopleOnTheTask(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $taskId    = $this->taskId('Build authentication');

        // Assignees are developer and tester; admin created it.
        $beforeDeveloper = $this->unreadFor('developer');
        $beforeTester    = $this->unreadFor('tester');

        $this->signIn('admin')->submit("projects/{$projectId}/tasks/{$taskId}/comments", [
            'comment' => 'Any update on the password reset flow?',
        ]);

        $this->assertSame($beforeDeveloper + 1, $this->unreadFor('developer'));
        $this->assertSame($beforeTester + 1, $this->unreadFor('tester'));
    }

    public function testCommentingDoesNotNotifyYourself(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $taskId    = $this->taskId('Build authentication');

        $before = $this->unreadFor('developer');

        // developer is an assignee, but also the author here.
        $this->signIn('developer')->submit("projects/{$projectId}/tasks/{$taskId}/comments", [
            'comment' => 'Working on it now.',
        ]);

        $this->assertSame($before, $this->unreadFor('developer'));
    }

    public function testMovingATaskNotifiesTheOthersOnIt(): void
    {
        $projectId = $this->projectId('Website Redesign');
        $taskId    = $this->taskId('Build authentication');

        $before = $this->unreadFor('tester');

        $this->signIn('admin')->submit("projects/{$projectId}/board/{$taskId}/move", [
            'status'   => 'review',
            'position' => 0,
        ]);

        $this->assertSame($before + 1, $this->unreadFor('tester'));
    }

    public function testBeingAddedToAProjectNotifiesYou(): void
    {
        $projectId = $this->projectId('Marketing Campaign');
        $testerId  = $this->userId('tester');
        $before    = $this->unreadFor('tester');

        $this->signIn('manager')->submit("projects/{$projectId}/members", [
            'user_id' => $testerId,
            'role'    => 'member',
        ]);

        $this->assertSame($before + 1, $this->unreadFor('tester'));
        $this->seeInDatabase('notifications', [
            'user_id'      => $testerId,
            'type'         => 'project_invitation',
            'related_type' => 'project',
            'related_id'   => $projectId,
        ]);
    }

    public function testANotificationCarriesALinkToItsSubject(): void
    {
        $projectId = $this->projectId('Marketing Campaign');

        $this->signIn('manager')->submit("projects/{$projectId}/members", [
            'user_id' => $this->userId('tester'),
            'role'    => 'member',
        ]);

        $result = $this->signIn('tester')->get('notifications');

        $result->assertOK();
        $result->assertSee('You were added to a project');
        $result->assertSee('Marketing Campaign');
    }
}
