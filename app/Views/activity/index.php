<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Activity · <?= esc($project['name']) ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
$humanise  = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$projectId = (int) $project['id'];
$hasFilter = $filters['entity_type'] !== '' || $filters['action'] !== '' || $filters['user_id'] !== '';
?>

<div class="page-header-row">
    <div>
        <h1>Activity</h1>
        <p class="text-muted">
            Everything that has happened in
            <a href="<?= url_to('projects.show', $projectId) ?>"><?= esc($project['name']) ?></a>
        </p>
    </div>
</div>

<section class="card mb-4">
    <div class="card-body">
        <form method="get" action="<?= url_to('activity.index', $projectId) ?>">
            <div class="form-grid">
                <div class="field">
                    <label for="entity_type">Type</label>
                    <select id="entity_type" name="entity_type">
                        <option value="">All types</option>
                        <?php foreach ($options['entity_types'] as $type) : ?>
                            <option value="<?= esc($type) ?>" <?= $filters['entity_type'] === $type ? 'selected' : '' ?>>
                                <?= esc($humanise($type)) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field">
                    <label for="action">Action</label>
                    <select id="action" name="action">
                        <option value="">All actions</option>
                        <?php foreach ($options['actions'] as $action) : ?>
                            <option value="<?= esc($action) ?>" <?= $filters['action'] === $action ? 'selected' : '' ?>>
                                <?= esc($humanise($action)) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field">
                    <label for="user_id">Person</label>
                    <select id="user_id" name="user_id">
                        <option value="">Anyone</option>
                        <?php foreach ($members as $member) : ?>
                            <?php $memberId = (string) $member['user_id']; ?>
                            <option value="<?= esc($memberId) ?>" <?= $filters['user_id'] === $memberId ? 'selected' : '' ?>>
                                <?= esc($member['username']) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field" style="align-self: end;">
                    <div class="toolbar">
                        <button type="submit" class="btn btn-primary">Apply</button>
                        <?php if ($hasFilter) : ?>
                            <a class="btn btn-ghost" href="<?= url_to('activity.index', $projectId) ?>">Clear</a>
                        <?php endif ?>
                    </div>
                </div>
            </div>
        </form>
    </div>
</section>

<section class="card">
    <?php if ($entries === []) : ?>
        <div class="empty-state">
            <h2><?= $hasFilter ? 'Nothing matches those filters' : 'Nothing recorded yet' ?></h2>
            <p>
                <?= $hasFilter
                    ? 'Try widening the filters above.'
                    : 'Changes to this project and its tasks will be listed here.' ?>
            </p>
        </div>
    <?php else : ?>
        <div>
            <?php foreach ($entries as $entry) : ?>
                <div class="activity-item">
                    <span class="avatar" aria-hidden="true">
                        <?= esc(mb_substr((string) ($entry['username'] ?? '?'), 0, 1)) ?>
                    </span>
                    <div style="flex: 1;">
                        <div class="activity-body">
                            <strong><?= esc($entry['username'] ?? 'A removed user') ?></strong>
                            <?= esc($entry['description'] ?? $entry['action']) ?>
                            <span class="badge"><?= esc($humanise((string) $entry['entity_type'])) ?></span>
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

        <?php if ($pager !== null && $pager->getPageCount() > 1) : ?>
            <div class="card-body" style="border-top: 1px solid var(--border);">
                <?= $pager->links() ?>
            </div>
        <?php endif ?>
    <?php endif ?>
</section>

<?= $this->endSection() ?>
