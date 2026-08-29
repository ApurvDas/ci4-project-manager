<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?><?= $task === null ? 'New task' : 'Edit task' ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
use App\Models\TaskModel;

$humanise  = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$projectId = (int) $project['id'];

$value = static function (string $field, ?string $fallback = null) use ($task): string {
    $old = old($field);

    if ($old !== null && $old !== '') {
        return (string) $old;
    }

    return (string) ($task[$field] ?? $fallback ?? '');
};
?>

<div class="page-header">
    <h1><?= $task === null ? 'New task' : 'Edit task' ?></h1>
    <p class="text-muted">
        In <a href="<?= url_to('projects.show', $projectId) ?>"><?= esc($project['name']) ?></a>
    </p>
</div>

<section class="card">
    <div class="card-body">
        <form action="<?= esc($action, 'attr') ?>" method="post" data-validated novalidate>
            <?= csrf_field() ?>

            <div class="form-grid">
                <div class="field form-full" data-validate="projectName">
                    <label for="title">Title</label>
                    <input type="text" id="title" name="title" value="<?= esc($value('title')) ?>"
                           maxlength="200" autofocus required>
                    <p class="field-error" role="alert"></p>
                </div>

                <div class="field form-full">
                    <label for="description">Description</label>
                    <textarea id="description" name="description" maxlength="5000"><?= esc($value('description')) ?></textarea>
                </div>

                <div class="field">
                    <label for="status">Status</label>
                    <select id="status" name="status" required>
                        <?php foreach (TaskModel::STATUSES as $status) : ?>
                            <option value="<?= esc($status) ?>" <?= $value('status', 'todo') === $status ? 'selected' : '' ?>>
                                <?= esc($humanise($status)) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority" required>
                        <?php foreach (TaskModel::PRIORITIES as $priority) : ?>
                            <option value="<?= esc($priority) ?>" <?= $value('priority', 'medium') === $priority ? 'selected' : '' ?>>
                                <?= esc($humanise($priority)) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field">
                    <label for="start_date">Start date</label>
                    <input type="date" id="start_date" name="start_date" value="<?= esc($value('start_date')) ?>">
                </div>

                <div class="field">
                    <label for="due_date">Due date</label>
                    <input type="date" id="due_date" name="due_date" value="<?= esc($value('due_date')) ?>">
                </div>

                <div class="field form-full">
                    <label>Assignees</label>
                    <?php if ($members === []) : ?>
                        <p class="hint">This project has no members to assign.</p>
                    <?php else : ?>
                        <div class="check-grid">
                            <?php foreach ($members as $member) : ?>
                                <?php $memberId = (int) $member['user_id']; ?>
                                <label class="checkbox">
                                    <input type="checkbox" name="assignees[]" value="<?= esc((string) $memberId) ?>"
                                        <?= in_array($memberId, $selectedUsers, true) ? 'checked' : '' ?>>
                                    <?= esc($member['username']) ?>
                                    <span class="text-muted">(<?= esc($humanise($member['role'])) ?>)</span>
                                </label>
                            <?php endforeach ?>
                        </div>
                        <p class="hint">A task can have as many assignees as it needs.</p>
                    <?php endif ?>
                </div>

                <div class="field form-full">
                    <label>Tags</label>
                    <?php if ($tags === []) : ?>
                        <p class="hint">No tags yet — create them on the project page.</p>
                    <?php else : ?>
                        <div class="check-grid">
                            <?php foreach ($tags as $tag) : ?>
                                <?php $tagId = (int) $tag['id']; ?>
                                <label class="checkbox">
                                    <input type="checkbox" name="tags[]" value="<?= esc((string) $tagId) ?>"
                                        <?= in_array($tagId, $selectedTags, true) ? 'checked' : '' ?>>
                                    <span class="tag-swatch" style="background: <?= esc($tag['color'], 'attr') ?>"></span>
                                    <?= esc($tag['name']) ?>
                                </label>
                            <?php endforeach ?>
                        </div>
                    <?php endif ?>
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary" data-busy-label="Saving…">
                    <?= $task === null ? 'Create task' : 'Save changes' ?>
                </button>
                <a class="btn btn-ghost"
                   href="<?= $task === null
                       ? url_to('projects.show', $projectId)
                       : url_to('tasks.show', $projectId, (int) $task['id']) ?>">Cancel</a>
            </div>
        </form>
    </div>
</section>

<?= $this->endSection() ?>
