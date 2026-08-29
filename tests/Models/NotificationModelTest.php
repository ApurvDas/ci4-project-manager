<?php

declare(strict_types=1);

namespace Tests\Models;

use App\Models\NotificationModel;
use Tests\Support\ModelTestCase;

/**
 * @internal
 */
final class NotificationModelTest extends ModelTestCase
{
    private NotificationModel $notifications;

    protected function setUp(): void
    {
        parent::setUp();

        $this->notifications = model(NotificationModel::class);
    }

    public function testUnreadCountIgnoresReadNotifications(): void
    {
        // developer has two unread; designer's only notification is read.
        $this->assertSame(2, $this->notifications->unreadCountFor($this->userId('developer')));
        $this->assertSame(0, $this->notifications->unreadCountFor($this->userId('designer')));
    }

    public function testRecentIsNewestFirst(): void
    {
        $recent = $this->notifications->recentFor($this->userId('developer'));

        $this->assertSame(NotificationModel::TYPE_TASK_DUE_SOON, $recent[0]['type']);
    }

    public function testRecentRespectsTheLimit(): void
    {
        $this->assertCount(1, $this->notifications->recentFor($this->userId('developer'), 1));
    }

    public function testUnreadForReturnsOnlyUnread(): void
    {
        $unread = $this->notifications->unreadFor($this->userId('tester'));

        $this->assertCount(1, $unread);
        $this->assertNull($unread[0]['read_at']);
    }

    public function testNotifyCreatesOneNotification(): void
    {
        $userId = $this->userId('admin');

        $this->notifications->notify(
            $userId,
            NotificationModel::TYPE_TASK_ASSIGNED,
            'You were assigned a task',
            'Create API',
            'task',
            $this->taskId('Create API'),
        );

        $this->assertSame(1, $this->notifications->unreadCountFor($userId));
        $this->seeInDatabase('notifications', [
            'user_id'      => $userId,
            'related_type' => 'task',
            'title'        => 'You were assigned a task',
        ]);
    }

    public function testNotifyManyNeverNotifiesTheActor(): void
    {
        $actorId = $this->userId('manager');

        $this->notifications->notifyMany(
            [$this->userId('developer'), $this->userId('tester'), $actorId],
            $actorId,
            NotificationModel::TYPE_COMMENT_ADDED,
            'New comment',
        );

        $this->assertSame(1, $this->notifications->unreadCountFor($actorId));
        $this->assertSame(3, $this->notifications->unreadCountFor($this->userId('developer')));
        $this->assertSame(2, $this->notifications->unreadCountFor($this->userId('tester')));
    }

    public function testNotifyManyWithOnlyTheActorSendsNothing(): void
    {
        $actorId = $this->userId('admin');
        $before  = $this->notifications->countAllResults();

        $this->notifications->notifyMany([$actorId], $actorId, 'test', 'Nothing');

        $this->assertSame($before, $this->notifications->countAllResults());
    }

    public function testNotifyManyStampsCreatedAt(): void
    {
        $recipient = $this->userId('designer');

        $this->notifications->notifyMany(
            [$recipient],
            $this->userId('admin'),
            NotificationModel::TYPE_MENTIONED,
            'You were mentioned',
        );

        $newest = $this->notifications->recentFor($recipient, 1)[0];

        $this->assertSame('You were mentioned', $newest['title']);
        $this->assertNotNull($newest['created_at']);
    }

    public function testMarkReadStampsReadAt(): void
    {
        $userId         = $this->userId('tester');
        $notificationId = (int) $this->notifications->unreadFor($userId)[0]['id'];

        $this->assertTrue($this->notifications->markRead($notificationId, $userId));
        $this->assertSame(0, $this->notifications->unreadCountFor($userId));
    }

    public function testMarkReadWillNotTouchAnotherUsersNotification(): void
    {
        $ownerId    = $this->userId('tester');
        $attackerId = $this->userId('admin');

        $notificationId = (int) $this->notifications->unreadFor($ownerId)[0]['id'];

        $this->notifications->markRead($notificationId, $attackerId);

        // Still unread: the row belongs to someone else.
        $this->assertSame(1, $this->notifications->unreadCountFor($ownerId));
        $this->assertNull($this->notifications->find($notificationId)['read_at']);
    }

    public function testMarkAllReadClearsOnlyThatUsersNotifications(): void
    {
        $userId = $this->userId('developer');

        $this->notifications->markAllRead($userId);

        $this->assertSame(0, $this->notifications->unreadCountFor($userId));
        // manager's unread notification is untouched.
        $this->assertSame(1, $this->notifications->unreadCountFor($this->userId('manager')));
    }
}
