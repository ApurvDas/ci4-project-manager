# Project Manager — Build Phases

How the app was created, reconstructed from git history and `docs/`. Stack: **CodeIgniter 4
+ Shield auth (PHP)**. This is the root git repo of `level-1`.

## Phases (in build order)
1. **CodeIgniter 4 setup** — starter project scaffold.
2. **Shield authentication foundation** — auth library wired in.
3. **Project database tables** — migrations for projects, members, tasks, etc.
4. **Development data seeders** — sample data for local dev.
5. **Project models** — data models over the tables.
6. **Authentication UI** — styled login / register / magic-link screens.
7. **Dashboard** — main landing view after login.
8. **Project management** — projects + members with roles.
9. **Task management** — tasks with multiple assignees, Kanban board, notifications.
10. **Activity system** — activity feed with diff rendering.
11. **Auth security test coverage** — tests around authentication.
12. **Interface polish** — restyled onto an achromatic palette.
13. **Production deployment prep** — see [[deployment|Deployment]].
14. **Self-hosted Nerd Fonts** — removed external font dependencies.
15. **Performance** — asset caching, font preloading, faster page loads.
16. **Playwright e2e** — end-to-end tests, later a smoke suite.

## Phase 15 — deferred auth decisions (open)
Two decisions were documented rather than built — see [[phase-15-auth-completion|Phase 15 Auth]]:
- **Password recovery style:** keep Shield's magic-link only (Option A) vs add a classic
  "enter new password twice" reset form (Option B, must be built on top of Shield, not beside it).
- **Email delivery:** `app/Config/Email.php` uses PHP `mail()` with no transport, so on
  Windows/Laragon every email is silently discarded — needs an SMTP transport configured.

Tests: [[tests-README|Tests]].
