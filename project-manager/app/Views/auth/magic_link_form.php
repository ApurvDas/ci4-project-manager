<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?>Reset your access<?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1>Can't sign in?</h1>
    <p>
        Enter your email address and we'll send you a one-time sign-in link.
        Once you are back in you can set a new password from your account
        settings.
    </p>
</div>

<?= $this->include('partials/alerts') ?>

<form class="auth-form" action="<?= url_to('magic-link') ?>" method="post" data-validated novalidate>
    <?= csrf_field() ?>

    <div class="field" data-validate="email">
        <label for="email"><?= lang('Auth.email') ?></label>
        <input type="email" id="email" name="email" value="<?= old('email') ?>"
               inputmode="email" autocomplete="email" autofocus required>
        <p class="field-error" role="alert"></p>
    </div>

    <button type="submit" class="btn btn-primary btn-block" data-busy-label="Sending…">
        Email me a sign-in link
    </button>
</form>

<p class="auth-meta">
    <a href="<?= url_to('login') ?>"><?= lang('Auth.backToLogin') ?></a>
</p>

<?= $this->endSection() ?>
