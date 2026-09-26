<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Welcome<?= $this->endSection() ?>

<?= $this->section('content') ?>

<div class="card">
    <div class="card-body">
        <h1 class="card-title">Plan the work, then track it</h1>
        <p class="card-subtitle">
            Projects, tasks, Kanban boards, checklists and activity history for
            your team — in one place.
        </p>

        <div class="row mt-5">
            <a class="btn btn-primary" href="<?= url_to('register') ?>">Create an account</a>
            <a class="btn btn-secondary" href="<?= url_to('login') ?>">Sign in</a>
        </div>
    </div>
</div>

<?= $this->endSection() ?>
