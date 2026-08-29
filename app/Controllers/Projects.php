<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\ProjectPolicy;
use App\Libraries\ProjectService;
use App\Models\ActivityLogModel;
use App\Models\ProjectMemberModel;
use App\Models\ProjectModel;
use App\Models\TagModel;
use App\Models\TaskModel;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\RedirectResponse;

class Projects extends BaseController
{
    private ProjectPolicy $policy;
    private ProjectService $service;

    public function __construct()
    {
        $this->policy  = new ProjectPolicy();
        $this->service = new ProjectService();
    }

    public function index(): string
    {
        $userId   = auth()->id();
        $projects = model(ProjectModel::class);
        $rows     = $projects->forUser($userId);

        return view('projects/index', [
            'projects' => $rows,
            'progress' => $projects->progressForMany(array_column($rows, 'id')),
        ]);
    }

    /**
     * The new-project form. Any signed-in user may start a project.
     */
    public function form(): string
    {
        return view('projects/form', [
            'project' => null,
            'action'  => url_to('projects.store'),
        ]);
    }

    public function store(): RedirectResponse
    {
        $projectId = $this->service->create(auth()->id(), $this->projectInput());

        if ($projectId === false) {
            return redirect()->back()->withInput()->with('errors', $this->service->errors());
        }

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('message', 'Project created.');
    }

    /**
     * The project dashboard.
     */
    public function show(int $projectId): string
    {
        $userId  = auth()->id();
        $project = $this->findOrFail($projectId, $userId);

        $members = model(ProjectMemberModel::class);

        return view('projects/show', [
            'project'    => $project,
            'role'       => $project['role'],
            'policy'     => $this->policy,
            'userId'     => $userId,
            'members'    => $members->membersOf($projectId),
            'candidates' => $this->policy->canManage($projectId, $userId)
                ? $members->candidatesFor($projectId)
                : [],
            'taskCounts' => model(TaskModel::class)->statusCountsFor($projectId),
            'progress'   => model(ProjectModel::class)->progressFor($projectId),
            'tags'       => model(TagModel::class)->forProject($projectId),
            'activity'   => model(ActivityLogModel::class)->recentForProject($projectId, 12),
        ]);
    }

    public function edit(int $projectId): RedirectResponse|string
    {
        $userId  = auth()->id();
        $project = $this->findOrFail($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canManage($projectId, $userId), $projectId)) {
            return $denied;
        }

        return view('projects/form', [
            'project' => $project,
            'action'  => url_to('projects.update', $projectId),
        ]);
    }

    public function update(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->findOrFail($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canManage($projectId, $userId), $projectId)) {
            return $denied;
        }

        if (! $this->service->update($projectId, $userId, $this->projectInput())) {
            return redirect()->back()->withInput()->with('errors', $this->service->errors());
        }

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('message', 'Project updated.');
    }

    public function archive(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->findOrFail($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canAdminister($projectId, $userId), $projectId)) {
            return $denied;
        }

        $this->service->archive($projectId, $userId);

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('message', 'Project archived.');
    }

    public function reopen(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->findOrFail($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canAdminister($projectId, $userId), $projectId)) {
            return $denied;
        }

        $this->service->reopen($projectId, $userId);

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('message', 'Project reopened.');
    }

    public function destroy(int $projectId): RedirectResponse
    {
        $userId = auth()->id();
        $this->findOrFail($projectId, $userId);

        if ($denied = $this->denyUnless($this->policy->canAdminister($projectId, $userId), $projectId)) {
            return $denied;
        }

        $this->service->delete($projectId, $userId);

        return redirect()
            ->to(url_to('projects.index'))
            ->with('message', 'Project deleted.');
    }

    /**
     * Load a project the user is actually a member of.
     *
     * A non-member gets the same 404 as a project that does not exist, so the
     * response never reveals which projects are out there.
     *
     * @return array<string, mixed>
     */
    private function findOrFail(int $projectId, int $userId): array
    {
        $project = model(ProjectModel::class)->findForUser($projectId, $userId);

        if ($project === null) {
            throw PageNotFoundException::forPageNotFound();
        }

        return $project;
    }

    /**
     * Returns a redirect when the action is not permitted, or null when it is.
     *
     * The caller must return the redirect immediately. Membership has already
     * been proven by findOrFail(), so the user is allowed to see the project —
     * they simply cannot perform this particular action, which is why this is
     * a refusal rather than a 404.
     */
    private function denyUnless(bool $allowed, int $projectId): ?RedirectResponse
    {
        if ($allowed) {
            return null;
        }

        return redirect()
            ->to(url_to('projects.show', $projectId))
            ->with('error', 'You do not have permission to do that.');
    }

    /**
     * Only the fields a user is allowed to set, with empty strings normalised
     * to null so optional dates are stored as NULL rather than "".
     *
     * @return array<string, mixed>
     */
    private function projectInput(): array
    {
        $input = [
            'name'        => trim((string) $this->request->getPost('name')),
            'description' => trim((string) $this->request->getPost('description')),
            'status'      => (string) $this->request->getPost('status'),
            'priority'    => (string) $this->request->getPost('priority'),
            'start_date'  => (string) $this->request->getPost('start_date'),
            'due_date'    => (string) $this->request->getPost('due_date'),
        ];

        foreach (['description', 'start_date', 'due_date'] as $field) {
            if ($input[$field] === '') {
                $input[$field] = null;
            }
        }

        return $input;
    }
}
