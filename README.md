# Project Manager

A team project-management web app: projects with member roles, tasks with a drag-and-drop
Kanban board, checklists, tags, comments, deadlines, notifications and a full activity history.

**Live app: https://apurvdas.github.io/ci4-project-manager/**

## Try it

Sign in with the shared guest account:

| Email | Password |
|---|---|
| `guest@example.com` | `TourTheBoard-2026` |

The guest is a member of a small team working on four projects: a coffee shop's online
ordering, a fitness app rebuild, a brand refresh, and a finished support portal. Things to try:

- **Dashboard**: your open tasks, deadlines and project progress at a glance.
- **Board**: drag a card between *Todo → In progress → Review → Completed*.
- **A task**: tick checklist items (progress updates live), paste a list into the checklist,
  or leave a comment.
- **Overdue work** is flagged in red. *Order status notifications* is already past its deadline.
- The **☾ / ☀ switch** in the top bar flips between dark and light mode. The app also works on phones.

This account is shared, so please keep it friendly. The sample data is reset from time to time.
Guests can't delete projects or manage members; those need a manager or owner role.
You can also **register your own account** and create projects of your own.

## How it's built

- **Front end:** plain HTML, CSS and JavaScript modules with no build step, served by GitHub Pages.
- **Back end:** [Supabase](https://supabase.com) (Postgres + Auth). Every permission is enforced in
  the database with row-level security and SQL functions, so the browser is never trusted.
- **Tests:** permission tests that call the API as each role, plus Playwright browser tests.

The code lives in [`project-manager/v2`](project-manager/v2); its README covers running it
locally, the tests and deployment. The original PHP / CodeIgniter 4 version is in
[`project-manager`](project-manager).
