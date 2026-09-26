<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Tasks · <?= esc($project['name']) ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
$humanise  = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$projectId = (int) $project['id'];
$today     = date('Y-m-d');

$dueState = static function (?string $due) use ($today): array {
    if ($due === null) {
        return ['', 'No due date'];
    }

    if ($due < $today) {
        return ['is-overdue', 'Overdue — ' . date('j M', strtotime($due))];
    }

    if ($due === $today) {
        return ['is-due-today', 'Due today'];
    }

    return ['', 'Due ' . date('j M Y', strtotime($due))];
};
?>

<div class="page-header-row">
    <div>
        <h1>Tasks</h1>
        <p class="text-muted">
            In <a href="<?= url_to('projects.show', $projectId) ?>"><?= esc($project['name']) ?></a>
        </p>
    </div>
    <div class="toolbar">
        <a class="btn btn-secondary" href="<?= url_to('board.show', $projectId) ?>">Board view</a>
        <?php if ($canWrite) : ?>
            <a class="btn btn-primary" href="<?= url_to('tasks.new', $projectId) ?>">New task</a>
        <?php endif ?>
    </div>
</div>

<section class="card">
    <?php if ($tasks === []) : ?>
        <div class="empty-state">
            <h2>No tasks yet</h2>
            <p>Break the project down into tasks to get started.</p>
        </div>
    <?php else : ?>
        <ul class="list">
            <?php foreach ($tasks as $task) : ?>
                <?php
                $taskId = (int) $task['id'];
                [$dueClass, $dueLabel] = $dueState($task['due_date']);
                ?>
                <li class="list-item">
                    <div>
                        <div class="list-item-title">
                            <a href="<?= url_to('tasks.show', $projectId, $taskId) ?>"><?= esc($task['title']) ?></a>
                        </div>
                        <div class="list-item-meta">
                            <span class="<?= esc($dueClass) ?>"><?= esc($dueLabel) ?></span>
                            <?php foreach ($tagsByTask[$taskId] ?? [] as $tag) : ?>
                                <span class="tag">
                                    <span class="tag-swatch" style="background: <?= esc($tag['color'], 'attr') ?>"></span>
                                    <?= esc($tag['name']) ?>
                                </span>
                            <?php endforeach ?>
                        </div>
                    </div>
                    <div class="list-item-aside">
                        <span class="badge badge-priority-<?= esc($task['priority']) ?>">
                            <?= esc($humanise($task['priority'])) ?>
                        </span>
                        <span class="badge badge-status-<?= esc($task['status']) ?>">
                            <?= esc($humanise($task['status'])) ?>
                        </span>
                    </div>
                </li>
            <?php endforeach ?>
        </ul>
    <?php endif ?>
</section>

<?= $this->endSection() ?>
