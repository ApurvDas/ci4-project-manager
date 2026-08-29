<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?><?= $currentUser !== null ? 'Home' : 'Welcome' ?><?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php if ($currentUser !== null) : ?>

    <div class="row-between mb-4">
        <div>
            <h1>Welcome back, <?= esc($currentUser->username) ?></h1>
            <p class="text-muted">You are signed in and your session is active.</p>
        </div>
    </div>

    <div class="card">
        <div class="empty-state">
            <h2>Your dashboard is next</h2>
            <p>
                Authentication is complete. Project statistics, assigned tasks
                and notifications will appear here once the dashboard is built.
            </p>
        </div>
    </div>

<?php else : ?>

    <div class="card">
        <div class="card-body">
            <h1 class="card-title">Plan the work, then track it</h1>
            <p class="card-subtitle">
                Projects, tasks, Kanban boards, checklists and activity history
                for your team — in one place.
            </p>

            <div class="row mt-5">
                <a class="btn btn-primary" href="<?= url_to('register') ?>">Create an account</a>
                <a class="btn btn-secondary" href="<?= url_to('login') ?>">Sign in</a>
            </div>
        </div>
    </div>

<?php endif ?>

<?= $this->endSection() ?>
