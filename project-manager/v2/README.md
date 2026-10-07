# Project Manager v2 — Supabase + GitHub Pages

The same app as the CodeIgniter version one folder up, rebuilt to host for free:

- **`web/`** is a static site (plain HTML, CSS and ES modules, no build step), published to GitHub Pages.
- **`supabase/`** holds the database: tables, row-level security, and the business rules as Postgres functions.

The browser is never trusted. Every permission from the old `ProjectPolicy` is enforced in
Postgres (`supabase/migrations/*_rls.sql`, `*_logic.sql`); the UI only hides controls.

## Live demo

https://apurvdas.github.io/project-manager/ — sign in as `guest@example.com` / `TourTheBoard-2026`.

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
   `https://apurvdas.github.io/project-manager/` and add it (with `**`) to the redirect URLs.
4. In GitHub → Settings → Secrets and variables → Actions → **Variables**, add `SUPABASE_URL`
   and `SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
5. In GitHub → Settings → Pages, set the source to **GitHub Actions**.
6. Push to `v2-supabase` (the default branch) — or run the "Deploy to GitHub Pages" workflow by hand.

Free-tier notes: a Supabase project pauses after about a week without activity (resume it from the
dashboard), and the built-in email sender is limited to a few emails an hour — add your own SMTP
under Authentication → Emails if you need more.

## Desktop app (Windows)

The same pages, in their own window: a small installer (it uses the WebView2 that Windows already
has), a tray icon whose tooltip shows the running timer, Windows notifications, automatic updates,
and the full offline editing the website has. It is a thin [Tauri](https://tauri.app) shell in
`desktop-app/` around `web/`, so web and desktop share one UI and one codebase.

**Install:** download the `.exe` from the repository's **Releases** page and run it (it installs for
your user, no admin needed). The installer is not code-signed, so Windows SmartScreen warns the first
time: choose **More info → Run anyway**. After that the app offers updates itself at start-up.

**Size and memory:** the installer is about 2 MB and the program 5 MB. Idle on the sign-in page, the
app (its process plus the seven WebView2 processes it starts) used about 170 MB of private memory,
against about 315 MB for Chrome showing the same page in a fresh profile (Windows 10, measured with
Task Manager's counters on 2026-10-01; your numbers will vary).

**Behaviour:** closing the window hides it to the tray (so the timer and reminders keep going);
**Quit** in the tray menu really exits. Tray → **Stop timer** stops the running timer. A toast
appears for each new notification and, once, for each of your open tasks due within the hour. Sign-in
by email link and password reset happen on the website: those links open it in your browser.

**Signing in:** **Sign in with your browser** opens the website, so your browser's saved password and
password reset work as usual. After you sign in there, the browser asks to open Project Manager:
allow it and the app is signed in. The website makes the app its own session (it doesn't share the
browser's), passes it back by an `apurvdas-pm://` link, and the app only accepts the sign-in it asked
for. The email and password form below the button still works too.

**Build it yourself** (needs [Rust](https://rustup.rs) and the Visual Studio C++ build tools):

```bash
npm run desktop:dev      # the app, pointed at http://localhost:8123 (starts the dev server for you)
npm run desktop:build    # an installer in desktop-app/src-tauri/target/release/bundle/nsis/
```

**Release it:** the *Desktop app* workflow builds the installer in GitHub Actions and publishes it
with the files the updater reads.

1. Add the Actions **variables** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the same ones the Pages deploy uses).
2. Add the **secrets** `TAURI_SIGNING_PRIVATE_KEY` (the content of the updater's private key) and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (empty if none). Make a key pair with
   `npx tauri signer generate -w ~/.tauri/pm-updater.key`, keep the private half out of the repository,
   and put the public half in `desktop-app/src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).
   Lose the private key and installed copies can never be updated again.
3. Bump `version` in `desktop-app/src-tauri/tauri.conf.json` and `Cargo.toml`, then push a tag:
   `git tag desktop-v0.1.1 && git push origin desktop-v0.1.1`.

The updater looks for `latest.json` on the repository's **latest** release, so keep desktop releases as the latest one.

## What changed from v1

- Soft deletes are gone: deleting a project, task or comment removes it (history rows survive).
- Rules v1 documented but didn't enforce are now enforced: assignees must be project members,
  task tags must belong to the task's project, and only the owner can archive (including through
  the edit form).
- Password reset is a classic "choose a new password" form (`reset.html`), alongside login links.
- Task notifications link to their task.
