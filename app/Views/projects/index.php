<?= $this->extend('layouts/main') ?>

<?= $this->section('title') ?>Projects<?= $this->endSection() ?>

<?= $this->section('content') ?>

<?php $humanise = static fn (string $value): string => ucfirst(str_replace('_', ' ', $value)); ?>

<div class="page-header-row">
    <div>
        <h1>Projects</h1>
        <p class="text-muted">Every project you own or belong to.</p>
    </div>
    <a class="btn btn-primary" href="<?= url_to('projects.new') ?>">New project</a>
</div>

<section class="card">
    <?php if ($projects === []) : ?>
        <div class="empty-state">
            <h2>No projects yet</h2>
            <p>Create your first project to start tracking work.</p>
            <div class="row mt-4" style="justify-content: center;">
                <a class="btn btn-primary" href="<?= url_to('projects.new') ?>">New project</a>
            </div>
        </div>
    <?php else : ?>
        <ul class="list">
            <?php foreach ($projects as $project) : ?>
                <?php $percent = $progress[(int) $project['id']] ?? 0; ?>
                <li class="list-item">
                    <div>
                        <div class="list-item-title">
                            <a href="<?= url_to('projects.show', (int) $project['id']) ?>">
                                <?= esc($project['name']) ?>
                            </a>
                        </div>
                        <div class="list-item-meta">
                            <span class="badge badge-status-<?= esc($project['status']) ?>">
                                <?= esc($humanise($project['status'])) ?>
                            </span>
                            <span class="badge badge-priority-<?= esc($project['priority']) ?>">
                                <?= esc($humanise($project['priority'])) ?>
                            </span>
                            <span><?= esc($humanise($project['role'])) ?></span>
                            <?php if ($project['due_date'] !== null) : ?>
                                <span aria-hidden="true">·</span>
                                <span>Due <?= esc(date('j M Y', strtotime($project['due_date']))) ?></span>
                            <?php endif ?>
                        </div>
                    </div>
                    <div class="list-item-aside">
                        <span class="text-muted"><?= esc((string) $percent) ?>%</span>
                        <span class="progress" role="img"
                              aria-label="<?= esc((string) $percent) ?>% of tasks complete">
                            <span class="progress-bar" style="width: <?= esc((string) $percent) ?>%"></span>
                        </span>
                    </div>
                </li>
            <?php endforeach ?>
        </ul>
    <?php endif ?>
</section>

<?= $this->endSection() ?>
