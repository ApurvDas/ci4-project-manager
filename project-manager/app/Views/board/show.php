<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Board · <?= esc($project['name']) ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
$humanise  = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$projectId = (int) $project['id'];
$today     = date('Y-m-d');
?>

<div class="page-header-row">
    <div>
        <h1>Board</h1>
        <p class="text-muted">
            In <a href="<?= url_to('projects.show', $projectId) ?>"><?= esc($project['name']) ?></a>
        </p>
    </div>
    <div class="toolbar">
        <a class="btn btn-secondary" href="<?= url_to('tasks.index', $projectId) ?>">List view</a>
        <?php if ($canWrite) : ?>
            <a class="btn btn-primary" href="<?= url_to('tasks.new', $projectId) ?>">New task</a>
        <?php endif ?>
    </div>
</div>

<?php if (! $canWrite) : ?>
    <div class="alert alert-info mb-4" role="status">
        You have read-only access to this project, so cards cannot be moved.
    </div>
<?php endif ?>

<div class="board"
     data-board
     data-move-url="<?= esc(url_to('board.move', $projectId, 0), 'attr') ?>"
     data-csrf-name="<?= esc(csrf_token(), 'attr') ?>"
     data-csrf-hash="<?= esc(csrf_hash(), 'attr') ?>"
     data-can-write="<?= $canWrite ? '1' : '0' ?>">

    <?php foreach ($board as $status => $columnTasks) : ?>
        <section class="board-column" data-status="<?= esc($status, 'attr') ?>">
            <header class="board-column-head">
                <h2><?= esc($humanise($status)) ?></h2>
                <span class="badge" data-column-count><?= esc((string) count($columnTasks)) ?></span>
            </header>

            <div class="board-dropzone" data-dropzone>
                <?php foreach ($columnTasks as $task) : ?>
                    <?php
                    $taskId  = (int) $task['id'];
                    $overdue = $task['due_date'] !== null
                        && $task['due_date'] < $today
                        && $task['status'] !== 'completed';
                    ?>
                    <article class="board-card" data-task-id="<?= esc((string) $taskId) ?>"
                             <?= $canWrite ? 'draggable="true"' : '' ?>>
                        <a class="board-card-title" href="<?= url_to('tasks.show', $projectId, $taskId) ?>">
                            <?= esc($task['title']) ?>
                        </a>

                        <div class="board-card-tags">
                            <?php foreach ($tagsByTask[$taskId] ?? [] as $tag) : ?>
                                <span class="tag">
                                    <span class="tag-swatch" style="background: <?= esc($tag['color'], 'attr') ?>"></span>
                                    <?= esc($tag['name']) ?>
                                </span>
                            <?php endforeach ?>
                        </div>

                        <div class="board-card-foot">
                            <span class="badge badge-priority-<?= esc($task['priority']) ?>">
                                <?= esc($humanise($task['priority'])) ?>
                            </span>
                            <?php if ($task['due_date'] !== null) : ?>
                                <span class="<?= $overdue ? 'is-overdue' : 'text-muted' ?>">
                                    <?= esc(date('j M', strtotime($task['due_date']))) ?>
                                </span>
                            <?php endif ?>
                        </div>

                        <?php if (! empty($assigneesByTask[$taskId])) : ?>
                            <div class="board-card-people">
                                <?php foreach ($assigneesByTask[$taskId] as $username) : ?>
                                    <span class="avatar avatar-sm" title="<?= esc($username, 'attr') ?>">
                                        <?= esc(mb_substr($username, 0, 1)) ?>
                                    </span>
                                <?php endforeach ?>
                            </div>
                        <?php endif ?>
                    </article>
                <?php endforeach ?>
            </div>
        </section>
    <?php endforeach ?>
</div>

<p class="board-status" data-board-status role="status" aria-live="polite"></p>

<script src="<?= versioned_asset('assets/js/board.js') ?>" defer></script>

<?= $this->endSection() ?>
