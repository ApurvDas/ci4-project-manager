<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?><?= lang('Auth.email2FATitle') ?><?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1><?= lang('Auth.email2FATitle') ?></h1>
    <p><?= lang('Auth.confirmEmailAddress') ?></p>
</div>

<?= $this->include('partials/alerts') ?>

<form class="auth-form" action="<?= url_to('auth-action-handle') ?>" method="post" data-validated novalidate>
    <?= csrf_field() ?>

    <div class="field" data-validate="email">
        <label for="email"><?= lang('Auth.email') ?></label>
        <input type="email" id="email" name="email" value="<?= old('email') ?>"
               inputmode="email" autocomplete="email" autofocus required>
        <p class="field-error" role="alert"></p>
    </div>

    <button type="submit" class="btn btn-primary btn-block" data-busy-label="Sending…">
        <?= lang('Auth.send') ?>
    </button>
</form>

<?= $this->endSection() ?>
