<?php
/**
 * The screen shown for an unhandled error when CI_ENVIRONMENT is production.
 *
 * It deliberately says nothing about what went wrong: exception messages,
 * stack traces and query text must never reach a normal user. The details are
 * in writable/logs.
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Something went wrong · Project Manager</title>
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
                        <h1>Something went wrong</h1>
                        <p>
                            The problem has been logged. Please try again, and let
                            an administrator know if it keeps happening.
                        </p>
                    </div>

                    <div class="row mt-5">
                        <a class="btn btn-primary" href="<?= base_url('dashboard') ?>">Go to dashboard</a>
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
