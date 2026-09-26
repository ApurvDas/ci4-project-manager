<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Notifications<?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php
/** Where a notification points, when we can work it out. */
$linkFor = static function (array $notification): ?string {
    if ($notification['related_type'] === 'project' && $notification['related_id'] !== null) {
        return url_to('projects.show', (int) $notification['related_id']);
    }

    return null;
};
?>

<div class="page-header-row">
    <div>
        <h1>Notifications</h1>
        <p class="text-muted">
            <?= $unreadCount > 0
                ? esc((string) $unreadCount) . ' unread'
                : 'You are all caught up.' ?>
        </p>
    </div>

    <?php if ($unreadCount > 0) : ?>
        <form method="post" action="<?= url_to('notifications.readAll') ?>">
            <?= csrf_field() ?>
            <button type="submit" class="btn btn-secondary">Mark all as read</button>
        </form>
    <?php endif ?>
</div>

<section class="card">
    <?php if ($notifications === []) : ?>
        <div class="empty-state">
            <h2>Nothing here yet</h2>
            <p>You will be told when you are assigned work, added to a project, or someone comments on your tasks.</p>
        </div>
    <?php else : ?>
        <ul class="list">
            <?php foreach ($notifications as $notification) : ?>
                <?php
                $isUnread = $notification['read_at'] === null;
                $link     = $linkFor($notification);
                ?>
                <li class="list-item <?= $isUnread ? 'is-unread' : '' ?>">
                    <div class="row">
                        <?php if ($isUnread) : ?>
                            <span class="notification-dot" role="img" aria-label="Unread"></span>
                        <?php else : ?>
                            <span class="notification-dot is-read" aria-hidden="true"></span>
                        <?php endif ?>

                        <div>
                            <div class="list-item-title">
                                <?php if ($link !== null) : ?>
                                    <a href="<?= esc($link, 'attr') ?>"><?= esc($notification['title']) ?></a>
                                <?php else : ?>
                                    <?= esc($notification['title']) ?>
                                <?php endif ?>
                            </div>
                            <div class="list-item-meta">
                                <?php if ($notification['message'] !== null) : ?>
                                    <span><?= esc($notification['message']) ?></span>
                                    <span aria-hidden="true">·</span>
                                <?php endif ?>
                                <span><?= esc(date('j M Y, H:i', strtotime((string) $notification['created_at']))) ?></span>
                            </div>
                        </div>
                    </div>

                    <?php if ($isUnread) : ?>
                        <form class="inline-form" method="post"
                              action="<?= url_to('notifications.read', (int) $notification['id']) ?>">
                            <?= csrf_field() ?>
                            <button type="submit" class="btn btn-secondary btn-sm">Mark as read</button>
                        </form>
                    <?php endif ?>
                </li>
            <?php endforeach ?>
        </ul>
    <?php endif ?>
</section>

<?= $this->endSection() ?>
