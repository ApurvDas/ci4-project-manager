<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?><?= lang('Auth.login') ?><?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1><?= lang('Auth.login') ?></h1>
    <p>Welcome back. Sign in to pick up where you left off.</p>
</div>

<?= $this->include('partials/alerts') ?>

<form class="auth-form" action="<?= url_to('login') ?>" method="post" data-validated novalidate>
    <?= csrf_field() ?>

    <div class="field" data-validate="email">
        <label for="email"><?= lang('Auth.email') ?></label>
        <input type="email" id="email" name="email" value="<?= old('email') ?>"
               inputmode="email" autocomplete="email" autofocus required>
        <p class="field-error" role="alert"></p>
    </div>

    <div class="field" data-validate="passwordRequired">
        <label for="password"><?= lang('Auth.password') ?></label>
        <div class="field-with-toggle">
            <input type="password" id="password" name="password" autocomplete="current-password" required>
            <button type="button" class="password-toggle" data-target="password" aria-pressed="false">Show</button>
        </div>
        <p class="field-error" role="alert"></p>
    </div>

    <?php if (setting('Auth.sessionConfig')['allowRemembering']) : ?>
        <div class="mt-4">
            <label class="checkbox">
                <input type="checkbox" name="remember" <?= old('remember') ? 'checked' : '' ?>>
                <?= lang('Auth.rememberMe') ?>
            </label>
        </div>
    <?php endif ?>

    <button type="submit" class="btn btn-primary btn-block" data-busy-label="Signing in…">
        <?= lang('Auth.login') ?>
    </button>
</form>

<?php if (setting('Auth.allowMagicLinkLogins')) : ?>
    <p class="auth-meta">
        <?= lang('Auth.forgotPassword') ?>
        <a href="<?= url_to('magic-link') ?>"><?= lang('Auth.useMagicLink') ?></a>
    </p>
<?php endif ?>

<?php if (setting('Auth.allowRegistration')) : ?>
    <p class="auth-meta">
        <?= lang('Auth.needAccount') ?>
        <a href="<?= url_to('register') ?>"><?= lang('Auth.register') ?></a>
    </p>
<?php endif ?>

<?= $this->endSection() ?>
