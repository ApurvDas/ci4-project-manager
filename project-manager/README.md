# Project Manager — v1 (CodeIgniter 4)

> This is the **original PHP / CodeIgniter 4** build (branch `v1-codeigniter`). The live, hosted
> version is **v2** — a Supabase + GitHub Pages rewrite in [`v2/`](v2). See the
> [repository README](../README.md) for both.

A project-management web application: projects, members with roles, tasks with
multiple assignees, a Kanban board, comments, tags, checklists, notifications
and a full activity history. Built on CodeIgniter 4 with CodeIgniter Shield for
authentication.

## Stack

- PHP 8.3, CodeIgniter 4.7, CodeIgniter Shield 1.4
- MySQL 8
- Plain CSS and vanilla JavaScript — no front-end framework
- Self-hosted fonts, no third-party requests

## What it does

- **Authentication** through Shield — registration, login, logout, and a
  magic-link recovery flow.
- **Projects** with an owner/manager/member/viewer role ladder, enforced
  server-side by `App\Libraries\ProjectPolicy`. A non-member gets a 404 rather
  than a refusal, so the response never reveals which projects exist.
- **Tasks** with multiple assignees, priorities, due dates, comments, tags and
  checklists.
- **Kanban board** with drag-and-drop that re-validates every move on the
  server; the browser is never trusted about what it may move.
- **Notifications** for assignment, status changes, comments and project
  invitations; the actor is never notified of their own action.
- **Activity log** — every change is recorded and shown as a filterable,
  paginated project history.

## Running it locally

Requires PHP 8.3, MySQL 8, and Composer. Node is only needed for the
end-to-end tests.

```bash
composer install
cp env .env            # then set the database section
php spark migrate
php spark db:seed DevelopmentSeeder
npm run serve          # http://localhost:8123
```

`npm run serve` runs PHP's built-in server through `public/dev-router.php`
rather than `php spark serve` — see [docs/deployment.md](docs/deployment.md) for
why, and for the production setup, the readiness check (`php spark app:preflight`)
and the backup procedure.

### Development sign-ins

The seeder creates five accounts, all with the password `Password123!`. Sign in
with the **email**, e.g. `admin@example.test` (`admin` is an owner and sees
every control). The others are `manager`, `developer`, `designer` and `tester`.

## Tests

```bash
vendor/bin/phpunit tests   # 244 unit and feature tests
npm run e2e                # Playwright browser tests
```

The PHPUnit suite drives the framework directly and covers models, controllers,
authorisation, and cross-cutting security (output escaping, CSRF, insecure
direct object references, mass assignment). The Playwright suite covers what it
cannot reach: the Kanban drag-and-drop, the AJAX checklist, inline validation,
the skip link, and the fonts and palette. Both run against a dedicated database.

## Known limitations

- **Email is not configured**, so password recovery and email verification do
  not send. See [docs/phase-15-auth-completion.md](docs/phase-15-auth-completion.md).
- No Content-Security-Policy and no login rate limiting yet — both noted in the
  deployment guide.

## Licence

No licence has been chosen yet. CodeIgniter and Shield keep their own licences;
add a `LICENSE` file to set the terms for the application code.
