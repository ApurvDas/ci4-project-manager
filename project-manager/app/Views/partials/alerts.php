<?php
/**
 * Flash message and validation error block.
 *
 * Shield sets `error` (single string), `errors` (array or string) and `message`
 * in the session; the application's own controllers use the same keys, so this
 * partial is the single place feedback is rendered.
 */
?>
<?php if (session('error') !== null) : ?>
    <div class="alert alert-error" role="alert">
        <?= esc(session('error')) ?>
    </div>
<?php endif ?>

<?php if (session('errors') !== null) : ?>
    <div class="alert alert-error" role="alert">
        <?php if (is_array(session('errors'))) : ?>
            <ul>
                <?php foreach (session('errors') as $error) : ?>
                    <li><?= esc($error) ?></li>
                <?php endforeach ?>
            </ul>
        <?php else : ?>
            <?= esc(session('errors')) ?>
        <?php endif ?>
    </div>
<?php endif ?>

<?php if (session('message') !== null) : ?>
    <div class="alert alert-success" role="status">
        <?= esc(session('message')) ?>
    </div>
<?php endif ?>
