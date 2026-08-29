<?php
/**
 * The signed-in application shell.
 *
 * Navigation reflects the authentication state: the primary links and the user
 * menu only appear for a signed-in user, and visitors are offered sign in and
 * create account instead. This is presentation only — access itself is enforced
 * by the `session` filter and by the model-level membership checks.
 */
$currentUser = auth()->user();
$current     = static fn (string $path): string => url_is($path) ? 'page' : 'false';
?>
<!DOCTYPE html>
<html lang="<?= service('request')->getLocale() ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= $this->renderSection('title') ?> · Project Manager</title>
    <link rel="stylesheet" href="<?= versioned_asset('assets/css/app.css') ?>">
</head>
<body>
    <?php /* First tab stop: lets a keyboard user jump past the navigation. */ ?>
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <header class="app-header">
        <div class="container">
            <a class="brand" href="<?= base_url('/') ?>">
                <span class="brand-mark" aria-hidden="true">PM</span>
                <span>Project Manager</span>
            </a>

            <?php if ($currentUser !== null) : ?>
                <nav class="app-nav" aria-label="Main">
                    <a href="<?= base_url('dashboard') ?>" aria-current="<?= $current('dashboard') ?>">Dashboard</a>
                    <a href="<?= base_url('projects') ?>" aria-current="<?= $current('projects*') ?>">Projects</a>
                </nav>
            <?php endif ?>

            <div class="app-header-actions">
                <?php if ($currentUser !== null) : ?>
                    <?= view_cell('App\Libraries\NotificationBadge::render') ?>
                    <span class="user-chip">
                        <span class="avatar" aria-hidden="true"><?= esc(mb_substr($currentUser->username ?? '?', 0, 1)) ?></span>
                        <span><?= esc($currentUser->username) ?></span>
                    </span>
                    <a class="btn btn-ghost" href="<?= url_to('logout') ?>">Sign out</a>
                <?php else : ?>
                    <a class="btn btn-ghost" href="<?= url_to('login') ?>">Sign in</a>
                    <a class="btn btn-primary" href="<?= url_to('register') ?>">Create account</a>
                <?php endif ?>
            </div>
        </div>
    </header>

    <main class="app-main" id="main-content" tabindex="-1">
        <div class="container">
            <?php /* Announced to screen readers when a flash message appears
                     after a redirect, without stealing focus. */ ?>
            <div aria-live="polite" aria-atomic="true">
                <?= $this->include('partials/alerts') ?>
            </div>
            <?= $this->renderSection('content') ?>
        </div>
    </main>

    <footer class="app-footer">
        <div class="container">
            &copy; <?= date('Y') ?> Project Manager
        </div>
    </footer>

    <script src="<?= versioned_asset('assets/js/forms.js') ?>" defer></script>
</body>
</html>
