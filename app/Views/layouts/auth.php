<!DOCTYPE html>
<html lang="<?= service('request')->getLocale() ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title><?= $this->renderSection('title') ?> · Project Manager</title>
    <link rel="stylesheet" href="<?= base_url('assets/css/app.css') ?>">
</head>
<body>
    <div class="auth-shell">
        <div class="auth-brand">
            <a class="brand" href="<?= base_url('/') ?>">
                <span class="brand-mark" aria-hidden="true">PM</span>
                <span>Project Manager</span>
            </a>
        </div>

        <main class="auth-body">
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

    <script src="<?= base_url('assets/js/forms.js') ?>" defer></script>
</body>
</html>
