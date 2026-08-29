<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Dashboard<?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
/**
 * Presentation helpers. These only format values the controller already
 * fetched — no queries and no decisions are made here.
 */
$today = date('Y-m-d');

/** "in_progress" -> "In progress" */
$humanise = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));

/** Returns [css class, label] for a due date relative to today. */
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

<div class="page-header">
    <h1>Dashboard</h1>
    <p>Your projects and the work assigned to you.</p>
</div>

<div class="stat-grid">
    <div class="stat">
        <div class="stat-value"><?= esc((string) $projectTotal) ?></div>
        <div class="stat-label">Total projects</div>
    </div>
    <div class="stat">
        <div class="stat-value"><?= esc((string) $projectCounts['active']) ?></div>
        <div class="stat-label">Active projects</div>
    </div>
    <div class="stat">
        <div class="stat-value"><?= esc((string) $projectCounts['completed']) ?></div>
        <div class="stat-label">Completed projects</div>
    </div>
    <div class="stat">
        <div class="stat-value"><?= esc((string) $unreadCount) ?></div>
        <div class="stat-label">Unread notifications</div>
    </div>

    <div class="stat">
        <div class="stat-value"><?= esc((string) $taskCounts['assigned']) ?></div>
        <div class="stat-label">Tasks assigned to you</div>
    </div>
    <div class="stat <?= $taskCounts['overdue'] > 0 ? 'is-alert' : '' ?>">
        <div class="stat-value"><?= esc((string) $taskCounts['overdue']) ?></div>
        <div class="stat-label">Overdue tasks</div>
    </div>
    <div class="stat <?= $taskCounts['due_today'] > 0 ? 'is-warn' : '' ?>">
        <div class="stat-value"><?= esc((string) $taskCounts['due_today']) ?></div>
        <div class="stat-label">Due today</div>
    </div>
    <div class="stat">
        <div class="stat-value"><?= esc((string) $taskCounts['completed']) ?></div>
        <div class="stat-label">Tasks completed</div>
    </div>
</div>

<div class="panels">
    <section class="card">
        <div class="panel-head">
            <h2>Your open tasks</h2>
            <span class="badge"><?= esc((string) count($myTasks)) ?></span>
        </div>

        <?php if ($myTasks === []) : ?>
            <div class="empty-state">
                <h2>Nothing on your plate</h2>
                <p>Tasks assigned to you will appear here.</p>
            </div>
        <?php else : ?>
            <ul class="list">
                <?php foreach ($myTasks as $task) : ?>
                    <?php [$dueClass, $dueLabel] = $dueState($task['due_date']); ?>
                    <li class="list-item">
                        <div>
                            <div class="list-item-title"><?= esc($task['title']) ?></div>
                            <div class="list-item-meta">
                                <span><?= esc($task['project_name']) ?></span>
                                <span aria-hidden="true">·</span>
                                <span class="<?= esc($dueClass) ?>"><?= esc($dueLabel) ?></span>
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

    <div class="stack">
        <section class="card">
            <div class="panel-head">
                <h2>Your projects</h2>
                <span class="badge"><?= esc((string) count($myProjects)) ?></span>
            </div>

            <?php if ($myProjects === []) : ?>
                <div class="empty-state">
                    <h2>No projects yet</h2>
                    <p>Projects you own or belong to will appear here.</p>
                </div>
            <?php else : ?>
                <ul class="list">
                    <?php foreach ($myProjects as $project) : ?>
                        <li class="list-item">
                            <div>
                                <div class="list-item-title"><?= esc($project['name']) ?></div>
                                <div class="list-item-meta">
                                    <span class="badge badge-status-<?= esc($project['status']) ?>">
                                        <?= esc($humanise($project['status'])) ?>
                                    </span>
                                    <span><?= esc($humanise($project['role'])) ?></span>
                                </div>
                            </div>
                            <div class="list-item-aside">
                                <?php $percent = $progress[(int) $project['id']] ?? 0; ?>
                                <span class="text-muted"><?= esc((string) $percent) ?>%</span>
                                <span class="progress" role="img"
                                      aria-label="<?= esc($percent) ?>% of tasks complete">
                                    <span class="progress-bar" style="width: <?= esc((string) $percent) ?>%"></span>
                                </span>
                            </div>
                        </li>
                    <?php endforeach ?>
                </ul>
            <?php endif ?>
        </section>

        <section class="card">
            <div class="panel-head">
                <h2>Notifications</h2>
                <?php if ($unreadCount > 0) : ?>
                    <span class="badge"><?= esc((string) $unreadCount) ?> unread</span>
                <?php endif ?>
            </div>

            <?php if ($notifications === []) : ?>
                <div class="empty-state">
                    <h2>All quiet</h2>
                    <p>You have no notifications yet.</p>
                </div>
            <?php else : ?>
                <ul class="list">
                    <?php foreach ($notifications as $notification) : ?>
                        <li class="list-item">
                            <div>
                                <div class="list-item-title"><?= esc($notification['title']) ?></div>
                                <div class="list-item-meta">
                                    <?php if ($notification['message'] !== null) : ?>
                                        <span><?= esc($notification['message']) ?></span>
                                    <?php endif ?>
                                </div>
                            </div>
                            <?php if ($notification['read_at'] === null) : ?>
                                <span class="notification-dot" role="img" aria-label="Unread"></span>
                            <?php endif ?>
                        </li>
                    <?php endforeach ?>
                </ul>
            <?php endif ?>
        </section>
    </div>
</div>

<?= $this->endSection() ?>
