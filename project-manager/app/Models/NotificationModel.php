<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\I18n\Time;
use CodeIgniter\Model;

class NotificationModel extends Model
{
    public const TYPE_TASK_ASSIGNED       = 'task_assigned';
    public const TYPE_TASK_STATUS_CHANGED = 'task_status_changed';
    public const TYPE_TASK_DUE_SOON       = 'task_due_soon';
    public const TYPE_COMMENT_ADDED       = 'comment_added';
    public const TYPE_PROJECT_INVITATION  = 'project_invitation';
    public const TYPE_MENTIONED           = 'mentioned';

    protected $table         = 'notifications';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = [
        'user_id',
        'type',
        'title',
        'message',
        'related_type',
        'related_id',
        'read_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $updatedField  = '';

    protected $validationRules = [
        'user_id'      => 'required|is_natural_no_zero',
        'type'         => 'required|string|max_length[50]',
        'title'        => 'required|string|max_length[150]',
        'message'      => 'permit_empty|string|max_length[255]',
        'related_type' => 'permit_empty|string|max_length[50]',
        'related_id'   => 'permit_empty|is_natural_no_zero',
    ];

    /**
     * Send one notification.
     */
    public function notify(
        int $userId,
        string $type,
        string $title,
        ?string $message = null,
        ?string $relatedType = null,
        ?int $relatedId = null,
    ): void {
        $this->insert([
            'user_id'      => $userId,
            'type'         => $type,
            'title'        => $title,
            'message'      => $message,
            'related_type' => $relatedType,
            'related_id'   => $relatedId,
        ]);
    }

    /**
     * Send the same notification to several people at once, skipping the actor
     * so nobody is notified about their own action.
     *
     * @param list<int> $userIds
     */
    public function notifyMany(
        array $userIds,
        int $excludeUserId,
        string $type,
        string $title,
        ?string $message = null,
        ?string $relatedType = null,
        ?int $relatedId = null,
    ): void {
        $recipients = array_values(array_diff(array_unique(array_map('intval', $userIds)), [$excludeUserId]));

        if ($recipients === []) {
            return;
        }

        $now = Time::now()->toDateTimeString();

        $this->db->table($this->table)->insertBatch(array_map(
            static fn (int $userId): array => [
                'user_id'      => $userId,
                'type'         => $type,
                'title'        => $title,
                'message'      => $message,
                'related_type' => $relatedType,
                'related_id'   => $relatedId,
                'created_at'   => $now,
            ],
            $recipients,
        ));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recentFor(int $userId, int $limit = 15): array
    {
        return $this->where('user_id', $userId)
            ->orderBy('created_at', 'DESC')
            ->orderBy('id', 'DESC')
            ->findAll($limit);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function unreadFor(int $userId, int $limit = 15): array
    {
        return $this->where('user_id', $userId)
            ->where('read_at', null)
            ->orderBy('created_at', 'DESC')
            ->orderBy('id', 'DESC')
            ->findAll($limit);
    }

    public function unreadCountFor(int $userId): int
    {
        return $this->where('user_id', $userId)
            ->where('read_at', null)
            ->countAllResults();
    }

    /**
     * Mark one notification read.
     *
     * Scoped by user id as well as notification id: a user must never be able
     * to touch someone else's notification by guessing a number.
     */
    public function markRead(int $notificationId, int $userId): bool
    {
        return $this->where('id', $notificationId)
            ->where('user_id', $userId)
            ->where('read_at', null)
            ->set('read_at', Time::now()->toDateTimeString())
            ->update();
    }

    public function markAllRead(int $userId): bool
    {
        return $this->where('user_id', $userId)
            ->where('read_at', null)
            ->set('read_at', Time::now()->toDateTimeString())
            ->update();
    }
}
