<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\TagModel;
use CodeIgniter\HTTP\RedirectResponse;

/**
 * Project tags. Any contributor may create one; removing one affects every
 * task that carries it, so that is limited to managers.
 */
class Tags extends ProjectScopedController
{
    public function create(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canContribute($projectId, $userId), $projectId)) {
            return $denied;
        }

        $tags = model(TagModel::class);
        $name = trim((string) $this->request->getPost('name'));

        if ($tags->nameExists($projectId, $name)) {
            return $this->back($projectId, 'error', 'That tag already exists in this project.');
        }

        $created = $tags->insert([
            'project_id' => $projectId,
            'name'       => $name,
            'color'      => (string) ($this->request->getPost('color') ?: TagModel::DEFAULT_COLOR),
        ]);

        if ($created === false) {
            return $this->back($projectId, 'errors', $tags->errors());
        }

        return $this->back($projectId, 'message', 'Tag created.');
    }

    public function destroy(int $projectId, int $tagId): RedirectResponse
    {
        $userId = auth()->id();
        $this->requireProject($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canDeleteTag($projectId, $userId), $projectId)) {
            return $denied;
        }

        $tag = model(TagModel::class)->find($tagId);

        // The tag must belong to the project in the URL.
        if ($tag === null || (int) $tag['project_id'] !== $projectId) {
            return $this->back($projectId, 'error', 'That tag no longer exists.');
        }

        model(TagModel::class)->delete($tagId);

        return $this->back($projectId, 'message', 'Tag deleted.');
    }

    private function back(int $projectId, string $key, mixed $payload): RedirectResponse
    {
        return redirect()->to(url_to('projects.show', $projectId))->with($key, $payload);
    }
}
