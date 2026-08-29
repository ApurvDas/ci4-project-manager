<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?><?= lang('Auth.register') ?><?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1><?= lang('Auth.register') ?></h1>
    <p>Set up an account to create projects and track work with your team.</p>
</div>

<?= $this->include('partials/alerts') ?>

<form class="auth-form" action="<?= url_to('register') ?>" method="post" data-validated novalidate>
    <?= csrf_field() ?>

    <div class="field" data-validate="email">
        <label for="email"><?= lang('Auth.email') ?></label>
        <input type="email" id="email" name="email" value="<?= old('email') ?>"
               inputmode="email" autocomplete="email" autofocus required>
        <p class="field-error" role="alert"></p>
    </div>

    <div class="field" data-validate="username">
        <label for="username"><?= lang('Auth.username') ?></label>
        <input type="text" id="username" name="username" value="<?= old('username') ?>"
               autocomplete="username" maxlength="30" required>
        <p class="hint">Letters, numbers, dots, underscores and hyphens.</p>
        <p class="field-error" role="alert"></p>
    </div>

    <div class="field" data-validate="password">
        <label for="password"><?= lang('Auth.password') ?></label>
        <div class="field-with-toggle">
            <input type="password" id="password" name="password" autocomplete="new-password" required>
            <button type="button" class="password-toggle" data-target="password" aria-pressed="false">Show</button>
        </div>
        <p class="hint">At least 8 characters, and not a password everyone else uses.</p>
        <p class="field-error" role="alert"></p>
    </div>

    <div class="field" data-validate="passwordConfirm">
        <label for="password_confirm"><?= lang('Auth.passwordConfirm') ?></label>
        <div class="field-with-toggle">
            <input type="password" id="password_confirm" name="password_confirm" autocomplete="new-password" required>
            <button type="button" class="password-toggle" data-target="password_confirm" aria-pressed="false">Show</button>
        </div>
        <p class="field-error" role="alert"></p>
    </div>

    <button type="submit" class="btn btn-primary btn-block" data-busy-label="Creating account…">
        <?= lang('Auth.register') ?>
    </button>
</form>

<p class="auth-meta">
    <?= lang('Auth.haveAccount') ?>
    <a href="<?= url_to('login') ?>"><?= lang('Auth.login') ?></a>
</p>

<?= $this->endSection() ?>
