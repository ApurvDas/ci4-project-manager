<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?><?= lang('Auth.email2FATitle') ?><?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1><?= lang('Auth.emailEnterCode') ?></h1>
    <p><?= lang('Auth.emailConfirmCode') ?></p>
</div>

<?= $this->include('partials/alerts') ?>

<form class="auth-form" action="<?= url_to('auth-action-verify') ?>" method="post" data-validated novalidate>
    <?= csrf_field() ?>

    <div class="field token-input" data-validate="token">
        <label for="token"><?= lang('Auth.token') ?></label>
        <input type="text" id="token" name="token" placeholder="000000"
               inputmode="numeric" autocomplete="one-time-code" maxlength="6" autofocus required>
        <p class="field-error" role="alert"></p>
    </div>

    <button type="submit" class="btn btn-primary btn-block" data-busy-label="Verifying…">
        <?= lang('Auth.confirm') ?>
    </button>
</form>

<?= $this->endSection() ?>
