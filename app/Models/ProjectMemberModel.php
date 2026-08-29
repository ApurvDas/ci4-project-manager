<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Database\ConnectionInterface;
use CodeIgniter\Model;
use CodeIgniter\Validation\ValidationInterface;

class ProjectMemberModel extends Model
{
    public const ROLE_OWNER   = 'owner';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_MEMBER  = 'member';
    public const ROLE_VIEWER  = 'viewer';

    public const ROLES = [self::ROLE_OWNER, self::ROLE_MANAGER, self::ROLE_MEMBER, self::ROLE_VIEWER];

    /**
     * Roles ordered from most to least privileged. Used by outranks() so
     * authorisation checks compare seniority rather than string equality.
     */
    private const HIERARCHY = [
        self::ROLE_OWNER   => 4,
        self::ROLE_MANAGER => 3,
        self::ROLE_MEMBER  => 2,
        self::ROLE_VIEWER  => 1,
    ];

    protected $table         = 'project_members';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['project_id', 'user_id', 'role'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'joined_at';
    // This table records when someone joined, not when the row last changed.
    protected $updatedField = '';

    protected $validationRules = [
        'project_id' => 'required|is_natural_no_zero',
        'user_id'    => 'required|is_natural_no_zero',
    ];

    public function __construct(?ConnectionInterface $db = null, ?ValidationInterface $validation = null)
    {
        parent::__construct($db, $validation);

        $this->validationRules['role'] = 'required|in_list[' . implode(',', self::ROLES) . ']';
    }

    /**
     * The role a user holds in a project, or null if they are not a member.
     * This is the primitive every server-side authorisation check builds on.
     */
    public function roleFor(int $projectId, int $userId): ?string
    {
        $row = $this->select('role')
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->first();

        return $row['role'] ?? null;
    }

    public function isMember(int $projectId, int $userId): bool
    {
        return $this->roleFor($projectId, $userId) !== null;
    }

    /**
     * Whether the user's role in the project is at least the one given.
     */
    public function hasAtLeast(int $projectId, int $userId, string $minimumRole): bool
    {
        $role = $this->roleFor($projectId, $userId);

        if ($role === null) {
            return false;
        }

        return self::HIERARCHY[$role] >= self::HIERARCHY[$minimumRole];
    }

    /**
     * Members of a project with their usernames, most privileged first.
     *
     * @return list<array<string, mixed>>
     */
    public function membersOf(int $projectId): array
    {
        return $this->select('project_members.*, users.username')
            ->join('users', 'users.id = project_members.user_id')
            ->where('project_members.project_id', $projectId)
            ->where('users.deleted_at', null)
            ->orderBy("FIELD(project_members.role, 'owner', 'manager', 'member', 'viewer')", '', false)
            ->orderBy('users.username', 'ASC')
            ->findAll();
    }

    /**
     * @return list<int>
     */
    public function userIdsFor(int $projectId): array
    {
        $rows = $this->select('user_id')->where('project_id', $projectId)->findAll();

        return array_map(static fn (array $row): int => (int) $row['user_id'], $rows);
    }
}
