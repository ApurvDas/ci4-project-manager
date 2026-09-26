<!DOCTYPE html>
<html lang="<?= service('request')->getLocale() ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title><?= $this->renderSection('title') ?> · Project Manager</title>

    <?php /* Preload the fonts used above the fold — see layouts/main.php. */ ?>
    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="<?= versioned_asset('assets/fonts/source-code-pro-400.woff2') ?>">
    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="<?= versioned_asset('assets/fonts/source-code-pro-600.woff2') ?>">
    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="<?= versioned_asset('assets/fonts/iosevka-term-slab-700.woff2') ?>">

    <link rel="stylesheet" href="<?= versioned_asset('assets/css/app.css') ?>">
</head>
<body>
    <a class="skip-link" href="#main-content">Skip to main content</a>

    <div class="auth-shell">
        <div class="auth-brand">
            <a class="brand" href="<?= base_url('/') ?>">
                <span class="brand-mark" aria-hidden="true">PM</span>
                <span>Project Manager</span>
            </a>
        </div>

        <main class="auth-body" id="main-content" tabindex="-1">
            <div class="auth-card">
                <div class="card-body">
                    <?= $this->renderSection('main') ?>
                </div>
            </div>
        </main>

        <footer class="auth-footer">
            &copy; <?= date('Y') ?> Project Manager
        </footer>
    </div>

    <script src="<?= versioned_asset('assets/js/forms.js') ?>" defer></script>
</body>
</html>
