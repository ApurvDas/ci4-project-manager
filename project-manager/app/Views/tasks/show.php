<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?><?= esc($task['title']) ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
$humanise  = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value));
$date      = static fn (?string $value): string => $value === null ? '—' : date('j M Y', strtotime($value));
$projectId = (int) $project['id'];
$taskId    = (int) $task['id'];
$today     = date('Y-m-d');

$overdue = $task['due_date'] !== null
    && $task['due_date'] < $today
    && $task['status'] !== 'completed';
?>

<div class="page-header-row">
    <div>
        <h1><?= esc($task['title']) ?></h1>
        <div class="list-item-meta">
            <a href="<?= url_to('projects.show', $projectId) ?>"><?= esc($project['name']) ?></a>
            <span aria-hidden="true">·</span>
            <span class="badge badge-status-<?= esc($task['status']) ?>"><?= esc($humanise($task['status'])) ?></span>
            <span class="badge badge-priority-<?= esc($task['priority']) ?>"><?= esc($humanise($task['priority'])) ?></span>
            <?php foreach ($tags as $tag) : ?>
                <span class="tag">
                    <span class="tag-swatch" style="background: <?= esc($tag['color'], 'attr') ?>"></span>
                    <?= esc($tag['name']) ?>
                </span>
            <?php endforeach ?>
        </div>
    </div>

    <div class="toolbar">
        <?php if ($canWrite) : ?>
            <a class="btn btn-secondary" href="<?= url_to('tasks.edit', $projectId, $taskId) ?>">Edit</a>
        <?php endif ?>
        <?php if ($canDelete) : ?>
            <form class="inline-form" method="post" action="<?= url_to('tasks.delete', $projectId, $taskId) ?>"
                  onsubmit="return confirm('Delete this task?');">
                <?= csrf_field() ?>
                <button type="submit" class="btn btn-danger">Delete</button>
            </form>
        <?php endif ?>
    </div>
</div>

<div class="panels">
    <div class="stack">
        <?php if ($task['description'] !== null && $task['description'] !== '') : ?>
            <section class="card">
                <div class="card-body">
                    <p><?= nl2br(esc($task['description'])) ?></p>
                </div>
            </section>
        <?php endif ?>

        <!-- Checklists -->
        <section class="card">
            <div class="panel-head">
                <h2>Checklists</h2>
                <?php if ($progress['total'] > 0) : ?>
                    <span class="badge" data-checklist-progress>
                        <?= esc((string) $progress['completed']) ?>/<?= esc((string) $progress['total']) ?>
                        · <?= esc((string) $progress['percent']) ?>%
                    </span>
                <?php endif ?>
            </div>

            <?php if ($checklists === []) : ?>
                <div class="empty-state">
                    <h2>No checklists</h2>
                    <p>Break this task into smaller steps.</p>
                </div>
            <?php else : ?>
                <?php foreach ($checklists as $checklist) : ?>
                    <div class="checklist">
                        <h3 class="checklist-title"><?= esc($checklist['title']) ?></h3>
                        <ul class="checklist-items">
                            <?php foreach ($checklist['items'] as $item) : ?>
                                <li class="checklist-item <?= $item['is_completed'] ? 'is-done' : '' ?>">
                                    <?php if ($canWrite) : ?>
                                        <form method="post" class="inline-form"
                                              action="<?= url_to('checklists.items.toggle', $projectId, $taskId, (int) $item['id']) ?>"
                                              data-toggle-item>
                                            <?= csrf_field() ?>
                                            <button type="submit" class="checklist-box"
                                                    aria-pressed="<?= $item['is_completed'] ? 'true' : 'false' ?>"
                                                    aria-label="Toggle <?= esc($item['content'], 'attr') ?>">
                                                <?= $item['is_completed'] ? '✓' : '' ?>
                                            </button>
                                        </form>
                                    <?php else : ?>
                                        <span class="checklist-box" aria-hidden="true"><?= $item['is_completed'] ? '✓' : '' ?></span>
                                    <?php endif ?>
                                    <span class="checklist-text"><?= esc($item['content']) ?></span>
                                </li>
                            <?php endforeach ?>
                        </ul>

                        <?php if ($canWrite) : ?>
                            <form class="checklist-add" method="post"
                                  action="<?= url_to('checklists.items.store', $projectId, $taskId, (int) $checklist['id']) ?>">
                                <?= csrf_field() ?>
                                <label class="visually-hidden" for="item-<?= esc((string) $checklist['id']) ?>">Add an item</label>
                                <input type="text" id="item-<?= esc((string) $checklist['id']) ?>" name="content"
                                       placeholder="Add an item" maxlength="255" required>
                                <button type="submit" class="btn btn-secondary btn-sm">Add</button>
                            </form>
                        <?php endif ?>
                    </div>
                <?php endforeach ?>
            <?php endif ?>

            <?php if ($canWrite) : ?>
                <div class="card-body" style="border-top: 1px solid var(--border);">
                    <form method="post" action="<?= url_to('checklists.store', $projectId, $taskId) ?>">
                        <?= csrf_field() ?>
                        <div class="field">
                            <label for="checklist-title">New checklist</label>
                            <input type="text" id="checklist-title" name="title" maxlength="150"
                                   placeholder="For example: Acceptance criteria" required>
                        </div>
                        <button type="submit" class="btn btn-secondary mt-4">Add checklist</button>
                    </form>
                </div>
            <?php endif ?>
        </section>

        <!-- Comments -->
        <section class="card">
            <div class="panel-head">
                <h2>Comments</h2>
                <span class="badge"><?= esc((string) count($comments)) ?></span>
            </div>

            <?php if ($comments === []) : ?>
                <div class="empty-state">
                    <h2>No comments yet</h2>
                    <p>Discussion about this task will appear here.</p>
                </div>
            <?php else : ?>
                <div>
                    <?php foreach ($comments as $comment) : ?>
                        <div class="activity-item">
                            <span class="avatar" aria-hidden="true"><?= esc(mb_substr($comment['username'], 0, 1)) ?></span>
                            <div style="flex: 1;">
                                <div class="row-between">
                                    <strong><?= esc($comment['username']) ?></strong>
                                    <?php if ($policy->canDeleteComment($projectId, $userId, $comment)) : ?>
                                        <form class="inline-form" method="post"
                                              action="<?= url_to('comments.delete', $projectId, $taskId, (int) $comment['id']) ?>"
                                              onsubmit="return confirm('Delete this comment?');">
                                            <?= csrf_field() ?>
                                            <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                                        </form>
                                    <?php endif ?>
                                </div>
                                <div class="activity-body"><?= nl2br(esc($comment['comment'])) ?></div>
                                <div class="activity-time">
                                    <?= esc(date('j M Y, H:i', strtotime((string) $comment['created_at']))) ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach ?>
                </div>
            <?php endif ?>

            <?php if ($canWrite) : ?>
                <div class="card-body" style="border-top: 1px solid var(--border);">
                    <form method="post" action="<?= url_to('comments.store', $projectId, $taskId) ?>">
                        <?= csrf_field() ?>
                        <div class="field">
                            <label for="comment">Add a comment</label>
                            <textarea id="comment" name="comment" maxlength="5000" required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary mt-4" data-busy-label="Posting…">Post comment</button>
                    </form>
                </div>
            <?php endif ?>
        </section>
    </div>

    <div class="stack">
        <section class="card">
            <div class="card-body">
                <dl class="meta-list">
                    <div>
                        <dt>Start date</dt>
                        <dd><?= esc($date($task['start_date'])) ?></dd>
                    </div>
                    <div>
                        <dt>Due date</dt>
                        <dd class="<?= $overdue ? 'is-overdue' : '' ?>"><?= esc($date($task['due_date'])) ?></dd>
                    </div>
                    <?php if ($task['completed_at'] !== null) : ?>
                        <div>
                            <dt>Completed</dt>
                            <dd><?= esc($date($task['completed_at'])) ?></dd>
                        </div>
                    <?php endif ?>
                </dl>
            </div>
        </section>

        <section class="card">
            <div class="panel-head">
                <h2>Assignees</h2>
                <span class="badge"><?= esc((string) count($assignees)) ?></span>
            </div>

            <?php if ($assignees === []) : ?>
                <div class="empty-state">
                    <h2>Unassigned</h2>
                    <p>Nobody is working on this yet.</p>
                </div>
            <?php else : ?>
                <ul class="list">
                    <?php foreach ($assignees as $assignee) : ?>
                        <li class="list-item">
                            <div class="row">
                                <span class="avatar" aria-hidden="true"><?= esc(mb_substr($assignee['username'], 0, 1)) ?></span>
                                <span class="list-item-title"><?= esc($assignee['username']) ?></span>
                            </div>
                        </li>
                    <?php endforeach ?>
                </ul>
            <?php endif ?>
        </section>

        <section class="card">
            <div class="panel-head">
                <h2>History</h2>
            </div>

            <?php if ($activity === []) : ?>
                <div class="empty-state">
                    <h2>Nothing recorded</h2>
                    <p>Changes to this task will be listed here.</p>
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
</div>

<?= $this->endSection() ?>
