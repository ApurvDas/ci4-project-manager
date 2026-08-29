<?= $this->extend('layouts/auth') ?>

<?= $this->section('title') ?>Check your email<?= $this->endSection() ?>

<?= $this->section('main') ?>

<div class="auth-header">
    <h1><?= lang('Auth.checkYourEmail') ?></h1>
    <p><?= lang('Auth.magicLinkDetails', [setting('Auth.magicLinkLifetime') / 60]) ?></p>
</div>

<?= $this->include('partials/alerts') ?>

<div class="alert alert-info mt-4" role="status">
    If nothing arrives, check your spam folder — or try again, since the link
    expires.
</div>

<p class="auth-meta">
    <a href="<?= url_to('login') ?>"><?= lang('Auth.backToLogin') ?></a>
</p>

<?= $this->endSection() ?>
