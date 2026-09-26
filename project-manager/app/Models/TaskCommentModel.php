<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class TaskCommentModel extends Model
{
    protected $table         = 'task_comments';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['task_id', 'user_id', 'comment'];

    protected $useTimestamps  = true;
    protected $useSoftDeletes = true;
    protected $dateFormat     = 'datetime';

    protected $validationRules = [
        'task_id' => 'required|is_natural_no_zero',
        'user_id' => 'required|is_natural_no_zero',
        'comment' => 'required|string|min_length[1]|max_length[5000]',
    ];

    protected $validationMessages = [
        'comment' => [
            'required' => 'A comment cannot be empty.',
        ],
    ];

    /**
     * A task's comment thread, oldest first, with author usernames.
     *
     * @return list<array<string, mixed>>
     */
    public function forTask(int $taskId): array
    {
        return $this->select('task_comments.*, users.username')
            ->join('users', 'users.id = task_comments.user_id')
            ->where('task_comments.task_id', $taskId)
            ->orderBy('task_comments.created_at', 'ASC')
            ->orderBy('task_comments.id', 'ASC')
            ->findAll();
    }

    public function countForTask(int $taskId): int
    {
        return $this->where('task_id', $taskId)->countAllResults();
    }
}
