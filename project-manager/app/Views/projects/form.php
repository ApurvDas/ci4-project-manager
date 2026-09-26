<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?><?= $project === null ? 'New project' : 'Edit project' ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
use App\Models\ProjectModel;

$humanise = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));

/** Prefer submitted input on redisplay, then the stored row, then a default. */
$value = static function (string $field, ?string $fallback = null) use ($project): string {
    $old = old($field);

    if ($old !== null && $old !== '') {
        return (string) $old;
    }

    return (string) ($project[$field] ?? $fallback ?? '');
};
?>

<div class="page-header">
    <h1><?= $project === null ? 'New project' : 'Edit project' ?></h1>
    <p class="text-muted">
        <?= $project === null
            ? 'You will be added as the owner automatically.'
            : 'Changes are recorded in the project activity history.' ?>
    </p>
</div>

<section class="card">
    <div class="card-body">
        <form action="<?= esc($action, 'attr') ?>" method="post" data-validated novalidate>
            <?= csrf_field() ?>

            <div class="form-grid">
                <div class="field form-full" data-validate="projectName">
                    <label for="name">Project name</label>
                    <input type="text" id="name" name="name" value="<?= esc($value('name')) ?>"
                           maxlength="150" autofocus required>
                    <p class="field-error" role="alert"></p>
                </div>

                <div class="field form-full">
                    <label for="description">Description</label>
                    <textarea id="description" name="description" maxlength="5000"
                              placeholder="What is this project for?"><?= esc($value('description')) ?></textarea>
                </div>

                <div class="field">
                    <label for="status">Status</label>
                    <select id="status" name="status" required>
                        <?php foreach (ProjectModel::STATUSES as $status) : ?>
                            <option value="<?= esc($status) ?>"
                                <?= $value('status', 'planning') === $status ? 'selected' : '' ?>>
                                <?= esc($humanise($status)) ?>
                            </option>
                        <?php endforeach ?>
                    </select>
                </div>

                <div class="field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority" required>
                        <?php foreach (ProjectModel::PRIORITIES as $priority) : ?>
                            <option value="<?= esc($priority) ?>"
                                <?= $value('priority', 'medium') === $priority ? 'selected' : '' ?>>
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
                    <p class="hint">Optional. Leave blank if there is no deadline.</p>
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary" data-busy-label="Saving…">
                    <?= $project === null ? 'Create project' : 'Save changes' ?>
                </button>
                <a class="btn btn-ghost"
                   href="<?= $project === null
                       ? url_to('projects.index')
                       : url_to('projects.show', (int) $project['id']) ?>">Cancel</a>
            </div>
        </form>
    </div>
</section>

<?= $this->endSection() ?>
