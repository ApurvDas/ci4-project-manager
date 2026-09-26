# Project Manager v2 — Supabase + GitHub Pages

The same app as the CodeIgniter version one folder up, rebuilt to host for free:

- **`web/`** is a static site (plain HTML, CSS and ES modules, no build step), published to GitHub Pages.
- **`supabase/`** holds the database: tables, row-level security, and the business rules as Postgres functions.

The browser is never trusted. Every permission from the old `ProjectPolicy` is enforced in
Postgres (`supabase/migrations/*_rls.sql`, `*_logic.sql`); the UI only hides controls.

## Live demo

https://apurvdas.github.io/ci4-project-manager/ — sign in as `guest@example.com` / `TourTheBoard-2026`.

The guest and its sample projects are built by `scripts/seed-showcase.mjs`. Re-run it to restore
them (it resets the showcase accounts and recreates their projects; nothing else is touched):

```bash
SUPABASE_URL=https://<ref>.supabase.co SERVICE_ROLE_KEY=... ANON_KEY=... GUEST_PASSWORD='TourTheBoard-2026' node scripts/seed-showcase.mjs
```

## Run it locally

Needs Docker Desktop running, and Node.

```bash
npm install
npx supabase start      # local Postgres + Auth + API; applies migrations and seed.sql
npm run serve           # http://localhost:8123
```

Sign in as `admin@example.test` (or `manager`, `developer`, `designer`, `tester`), password
`Password123!`. Emails the app sends locally (login links, password resets) land in Mailpit at
http://127.0.0.1:54324. Supabase Studio (a database UI) is at http://127.0.0.1:54323.

`npx supabase db reset` rebuilds the database from scratch.

## Tests

```bash
npm test          # permission rules, called through the API as each seeded role
npm run e2e       # Playwright browser tests
```

Both need the local stack running.

## Deploy (free)

1. Create a free project at https://supabase.com.
2. Push the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
   (Don't load `seed.sql` in production; register real accounts instead.)
3. In Supabase → Authentication → URL Configuration, set the Site URL to
   `https://apurvdas.github.io/ci4-project-manager/` and add it (with `**`) to the redirect URLs.
4. In GitHub → Settings → Secrets and variables → Actions → **Variables**, add `SUPABASE_URL`
   and `SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
5. In GitHub → Settings → Pages, set the source to **GitHub Actions**.
6. Push to `supabase-rewrite` or `main` (or run the "Deploy to GitHub Pages" workflow by hand).

Free-tier notes: a Supabase project pauses after about a week without activity (resume it from the
dashboard), and the built-in email sender is limited to a few emails an hour — add your own SMTP
under Authentication → Emails if you need more.

## What changed from v1

- Soft deletes are gone: deleting a project, task or comment removes it (history rows survive).
- Rules v1 documented but didn't enforce are now enforced: assignees must be project members,
  task tags must belong to the task's project, and only the owner can archive (including through
  the edit form).
- Password reset is a classic "choose a new password" form (`reset.html`), alongside login links.
- Task notifications link to their task.
