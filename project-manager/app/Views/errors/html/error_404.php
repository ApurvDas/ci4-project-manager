<?php
/**
 * Page-not-found screen.
 *
 * Deliberately vague: this is also what a signed-in user sees when they ask for
 * a project or task they are not a member of, so it must not hint at whether
 * the thing exists.
 *
 * Standalone rather than extending the app layout, because an error can happen
 * before or outside the normal request flow.
 */
$message = $message ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page not found · Project Manager</title>
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
                    <div class="auth-header">
                        <h1>We can't find that page</h1>
                        <p>
                            The link may be wrong, the item may have been deleted,
                            or you may not have access to it.
                        </p>
                    </div>

                    <div class="row mt-5">
                        <a class="btn btn-primary" href="<?= base_url('dashboard') ?>">Go to dashboard</a>
                        <a class="btn btn-secondary" href="<?= base_url('projects') ?>">Your projects</a>
                    </div>
                </div>
            </div>
        </main>

        <footer class="auth-footer">
            &copy; <?= date('Y') ?> Project Manager
        </footer>
    </div>
</body>
</html>
