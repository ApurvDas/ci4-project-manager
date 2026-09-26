<?php

declare(strict_types=1);

namespace App\Libraries;

use App\Models\NotificationModel;

/**
 * The unread-count badge in the header.
 *
 * Rendered as a view cell so the layout does not have to run a query itself,
 * and so every page gets a current count without each controller having to
 * remember to pass one.
 */
class NotificationBadge
{
    public function render(): string
    {
        if (! auth()->loggedIn()) {
            return '';
        }

        return view('cells/notification_badge', [
            'count' => model(NotificationModel::class)->unreadCountFor(auth()->id()),
        ]);
    }
}
