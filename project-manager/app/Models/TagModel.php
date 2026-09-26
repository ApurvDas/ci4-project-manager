<?php

declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class TagModel extends Model
{
    public const DEFAULT_COLOR = '#6B7280';

    protected $table         = 'tags';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['project_id', 'name', 'color'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $updatedField  = '';

    protected $validationRules = [
        'project_id' => 'required|is_natural_no_zero',
        'name'       => 'required|string|min_length[1]|max_length[50]',
        // Six-digit hex, matching the varchar(7) column.
        'color' => 'required|regex_match[/^#[0-9A-Fa-f]{6}$/]',
    ];

    protected $validationMessages = [
        'color' => [
            'regex_match' => 'Pick a colour in six-digit hex form, for example #4F46E5.',
        ],
    ];

    /**
     * @return list<array<string, mixed>>
     */
    public function forProject(int $projectId): array
    {
        return $this->where('project_id', $projectId)
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    /**
     * Whether a tag name is already taken in a project. The database enforces
     * this too via UNIQUE(project_id, name); this exists so the user gets a
     * validation message instead of a duplicate-key error.
     */
    public function nameExists(int $projectId, string $name, ?int $exceptId = null): bool
    {
        $this->where('project_id', $projectId)->where('name', $name);

        if ($exceptId !== null) {
            $this->where('id !=', $exceptId);
        }

        return $this->countAllResults() > 0;
    }
}
