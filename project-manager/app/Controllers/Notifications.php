<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\NotificationModel;
use CodeIgniter\HTTP\RedirectResponse;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * The signed-in user's notifications.
 *
 * Every query and every write is scoped to auth()->id(); a notification id
 * alone is never enough to read or change a row.
 */
class Notifications extends BaseController
{
    public function index(): string
    {
        $userId        = auth()->id();
        $notifications = model(NotificationModel::class);

        return view('notifications/index', [
            'notifications' => $notifications->recentFor($userId, 50),
            'unreadCount'   => $notifications->unreadCountFor($userId),
        ]);
    }

    public function read(int $notificationId): RedirectResponse|ResponseInterface
    {
        $userId = auth()->id();

        // Scoped by user id as well as notification id, so guessing a number
        // cannot mark somebody else's notification read.
        model(NotificationModel::class)->markRead($notificationId, $userId);

        if ($this->request->isAJAX()) {
            return $this->response->setJSON([
                'ok'          => true,
                'unreadCount' => model(NotificationModel::class)->unreadCountFor($userId),
                'csrf'        => ['name' => csrf_token(), 'hash' => csrf_hash()],
            ]);
        }

        return redirect()->to(url_to('notifications.index'));
    }

    public function readAll(): RedirectResponse
    {
        model(NotificationModel::class)->markAllRead(auth()->id());

        return redirect()->to(url_to('notifications.index'))->with('message', 'All notifications marked as read.');
    }
}
