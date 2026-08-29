<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?><?= esc($project['name']) ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
use App\Models\ProjectMemberModel;
use App\Models\TaskModel;

$humanise = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$date     = static fn (?string $value): string => $value === null ? '—' : date('j M Y', strtotime($value));

$projectId = (int) $project['id'];
$canManage = $policy->canManage($projectId, $userId);
$canAdmin  = $policy->canAdminister($projectId, $userId);

/** Roles a manager may hand out; the owner may also appoint managers. */
$assignableRoles = $canAdmin
    ? [ProjectMemberModel::ROLE_MANAGER, ProjectMemberModel::ROLE_MEMBER, ProjectMemberModel::ROLE_VIEWER]
    : [ProjectMemberModel::ROLE_MEMBER, ProjectMemberModel::ROLE_VIEWER];
?>

<div class="page-header-row">
    <div>
        <h1><?= esc($project['name']) ?></h1>
        <div class="list-item-meta">
            <span class="badge badge-status-<?= esc($project['status']) ?>">
                <?= esc($humanise($project['status'])) ?>
            </span>
            <span class="badge badge-priority-<?= esc($project['priority']) ?>">
                <?= esc($humanise($project['priority'])) ?>
            </span>
            <span>You are <?= esc($humanise($role)) ?></span>
        </div>
    </div>

    <?php /* Buttons are hidden for people who cannot use them, but the
             controller re-checks every one of these actions server-side. */ ?>
    <div class="toolbar">
        <?php if ($canManage) : ?>
            <a class="btn btn-secondary" href="<?= url_to('projects.edit', $projectId) ?>">Edit</a>
        <?php endif ?>

        <?php if ($canAdmin) : ?>
            <?php if ($project['status'] === 'archived') : ?>
                <form class="inline-form" action="<?= url_to('projects.reopen', $projectId) ?>" method="post">
                    <?= csrf_field() ?>
                    <button type="submit" class="btn btn-secondary">Reopen</button>
                </form>
            <?php else : ?>
                <form class="inline-form" action="<?= url_to('projects.archive', $projectId) ?>" method="post">
                    <?= csrf_field() ?>
                    <button type="submit" class="btn btn-secondary">Archive</button>
                </form>
            <?php endif ?>

            <form class="inline-form" action="<?= url_to('projects.delete', $projectId) ?>" method="post"
                  onsubmit="return confirm('Delete this project? It can be restored by a developer, but it will disappear from every list.');">
                <?= csrf_field() ?>
                <button type="submit" class="btn btn-danger">Delete</button>
            </form>
        <?php endif ?>
    </div>
</div>

<?php if ($project['description'] !== null && $project['description'] !== '') : ?>
    <section class="card mb-4">
        <div class="card-body">
            <p><?= nl2br(esc($project['description'])) ?></p>
        </div>
    </section>
<?php endif ?>

<section class="card mb-4">
    <div class="card-body">
        <dl class="meta-list">
            <div>
                <dt>Start date</dt>
                <dd><?= esc($date($project['start_date'])) ?></dd>
            </div>
            <div>
                <dt>Due date</dt>
                <dd><?= esc($date($project['due_date'])) ?></dd>
            </div>
            <div>
                <dt>Members</dt>
                <dd><?= esc((string) count($members)) ?></dd>
            </div>
            <div>
                <dt>Progress</dt>
                <dd><?= esc((string) $progress) ?>%</dd>
            </div>
        </dl>
    </div>
</section>

<div class="stat-grid">
    <?php foreach (TaskModel::STATUSES as $status) : ?>
        <div class="stat">
            <div class="stat-value"><?= esc((string) $taskCounts[$status]) ?></div>
            <div class="stat-label"><?= esc($humanise($status)) ?></div>
        </div>
    <?php endforeach ?>
</div>

<div class="panels">
    <div class="stack">
        <section class="card">
            <div class="panel-head">
                <h2>Task board</h2>
            </div>
            <div class="empty-state">
                <h2>Tasks arrive next</h2>
                <p>
                    Task management and the Kanban board are built in the
                    following phases. The counts above are already live.
                </p>
            </div>
        </section>

        <section class="card">
            <div class="panel-head">
                <h2>Recent activity</h2>
            </div>

            <?php if ($activity === []) : ?>
                <div class="empty-state">
                    <h2>Nothing recorded yet</h2>
                    <p>Changes to this project will be listed here.</p>
                </div>
            <?php else : ?>
                <div>
                    <?php foreach ($activity as $entry) : ?>
                        <div class="activity-item">
                            <span class="avatar" aria-hidden="true">
                                <?= esc(mb_substr((string) ($entry['username'] ?? '?'), 0, 1)) ?>
                            </span>
                            <div>
                                <div class="activity-body">
                                    <strong><?= esc($entry['username'] ?? 'A removed user') ?></strong>
                                    <?= esc($entry['description'] ?? $entry['action']) ?>
                                </div>
                                <?php if (! empty($entry['new_values'])) : ?>
                                    <div class="activity-diff">
                                        <?php foreach ($entry['new_values'] as $field => $newValue) : ?>
                                            <?= esc($field) ?>:
                                            <?= esc((string) ($entry['old_values'][$field] ?? '—')) ?>
                                            &rarr; <?= esc((string) $newValue) ?><br>
                                        <?php endforeach ?>
                                    </div>
                                <?php endif ?>
                                <div class="activity-time">
                                    <?= esc(date('j M Y, H:i', strtotime((string) $entry['created_at']))) ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach ?>
                </div>
            <?php endif ?>
        </section>
    </div>

    <div class="stack">
        <section class="card">
            <div class="panel-head">
                <h2>Members</h2>
                <span class="badge"><?= esc((string) count($members)) ?></span>
            </div>

            <ul class="list">
                <?php foreach ($members as $member) : ?>
                    <?php
                    $memberId  = (int) $member['user_id'];
                    $canRemove = $policy->canRemoveMember($projectId, $userId, $memberId);
                    $canRole   = $policy->canChangeRole($projectId, $userId, $memberId, ProjectMemberModel::ROLE_MEMBER);
                    ?>
                    <li class="list-item">
                        <div class="row">
                            <span class="avatar" aria-hidden="true"><?= esc(mb_substr($member['username'], 0, 1)) ?></span>
                            <div>
                                <div class="list-item-title"><?= esc($member['username']) ?></div>
                                <div class="list-item-meta"><?= esc($humanise($member['role'])) ?></div>
                            </div>
                        </div>

                        <div class="list-item-aside">
                            <?php if ($canRole) : ?>
                                <form class="inline-form" method="post"
                                      action="<?= url_to('projects.members.role', $projectId, $memberId) ?>">
                                    <?= csrf_field() ?>
                                    <label class="visually-hidden" for="role-<?= esc((string) $memberId) ?>">
                                        Role for <?= esc($member['username']) ?>
                                    </label>
                                    <select id="role-<?= esc((string) $memberId) ?>" name="role">
                                        <?php foreach ($assignableRoles as $option) : ?>
                                            <option value="<?= esc($option) ?>"
                                                <?= $member['role'] === $option ? 'selected' : '' ?>>
                                                <?= esc($humanise($option)) ?>
                                            </option>
                                        <?php endforeach ?>
                                    </select>
                                    <button type="submit" class="btn btn-secondary btn-sm">Save</button>
                                </form>
                            <?php endif ?>

                            <?php if ($canRemove) : ?>
                                <form class="inline-form" method="post"
                                      action="<?= url_to('projects.members.remove', $projectId, $memberId) ?>"
                                      onsubmit="return confirm('Remove <?= esc($member['username'], 'js') ?> from this project?');">
                                    <?= csrf_field() ?>
                                    <button type="submit" class="btn btn-danger btn-sm">Remove</button>
                                </form>
                            <?php endif ?>
                        </div>
                    </li>
                <?php endforeach ?>
            </ul>

            <?php if ($canManage) : ?>
                <div class="card-body" style="border-top: 1px solid var(--border);">
                    <?php if ($candidates === []) : ?>
                        <p class="text-muted">Everyone is already a member of this project.</p>
                    <?php else : ?>
                        <form method="post" action="<?= url_to('projects.members.add', $projectId) ?>">
                            <?= csrf_field() ?>
                            <div class="field">
                                <label for="user_id">Add a member</label>
                                <select id="user_id" name="user_id" required>
                                    <?php foreach ($candidates as $candidate) : ?>
                                        <option value="<?= esc((string) $candidate['id']) ?>">
                                            <?= esc($candidate['username']) ?>
                                        </option>
                                    <?php endforeach ?>
                                </select>
                            </div>
                            <div class="field">
                                <label for="member_role">Role</label>
                                <select id="member_role" name="role" required>
                                    <?php foreach ($assignableRoles as $option) : ?>
                                        <option value="<?= esc($option) ?>"
                                            <?= $option === ProjectMemberModel::ROLE_MEMBER ? 'selected' : '' ?>>
                                            <?= esc($humanise($option)) ?>
                                        </option>
                                    <?php endforeach ?>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-secondary mt-4">Add to project</button>
                        </form>
                    <?php endif ?>
                </div>
            <?php endif ?>
        </section>

        <section class="card">
            <div class="panel-head">
                <h2>Tags</h2>
                <span class="badge"><?= esc((string) count($tags)) ?></span>
            </div>

            <?php if ($tags === []) : ?>
                <div class="empty-state">
                    <h2>No tags</h2>
                    <p>Tags are managed alongside tasks.</p>
                </div>
            <?php else : ?>
                <div class="tag-list">
                    <?php foreach ($tags as $tag) : ?>
                        <span class="tag">
                            <span class="tag-swatch" style="background: <?= esc($tag['color'], 'attr') ?>"></span>
                            <?= esc($tag['name']) ?>
                        </span>
                    <?php endforeach ?>
                </div>
            <?php endif ?>
        </section>
    </div>
</div>

<?= $this->endSection() ?>
