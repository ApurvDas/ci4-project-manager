<a class="notification-link" href="<?= url_to('notifications.index') ?>"
   aria-label="Notifications<?= $count > 0 ? ', ' . $count . ' unread' : '' ?>">
    <span aria-hidden="true">Notifications</span>
    <?php if ($count > 0) : ?>
        <span class="notification-count"><?= esc((string) min($count, 99)) ?></span>
    <?php endif ?>
</a>
