<?php

declare(strict_types=1);

namespace App\Database\Seeds;

/**
 * Lookup helpers shared by the development seeders.
 *
 * Seeders reference each other by natural key (username, project name, task
 * title) instead of hard-coded ids, so they stay correct whatever the
 * auto-increment counters happen to be.
 */
trait ResolvesSeedIds
{
    /**
     * @return array<string, int> username => id
     */
    protected function userIds(): array
    {
        return $this->columnMap('users', 'username');
    }

    /**
     * @return array<string, int> project name => id
     */
    protected function projectIds(): array
    {
        return $this->columnMap('projects', 'name');
    }

    /**
     * @return array<string, int> task title => id
     */
    protected function taskIds(): array
    {
        return $this->columnMap('tasks', 'title');
    }

    /**
     * @return array<string, int> tag "project_id:name" => id
     */
    protected function tagIds(): array
    {
        $map = [];

        foreach ($this->db->table('tags')->select('id, project_id, name')->get()->getResultArray() as $row) {
            $map[$row['project_id'] . ':' . $row['name']] = (int) $row['id'];
        }

        return $map;
    }

    /**
     * @return array<string, int> label => id
     */
    private function columnMap(string $table, string $labelColumn): array
    {
        $map = [];

        foreach ($this->db->table($table)->select("id, {$labelColumn}")->get()->getResultArray() as $row) {
            $map[$row[$labelColumn]] = (int) $row['id'];
        }

        return $map;
    }
}
