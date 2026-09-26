# Focus ⏱

A motion-first **focus webapp** — Pomodoro timer, reminders, focus tasks, and
streak/stat tracking — grown from the seed `RemainderApplication-main` desktop
reminder app. Python backend, one process, no build step.

## Stack
- **Backend:** FastAPI + Jinja2 (server-rendered pages + a small JSON API), SQLite. Single-user, no login.
- **Frontend:** Tailwind (standalone, vendored) + anime.js **v4** (vendored). Design tokens and
  the motion vocabulary are ported from `ciba_library` (accent swapped to the seed's coral `#FF5733`).
  Light + dark mode, reduced-motion respected throughout.

## Run
```bash
cd RemainderApplication-main
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt   # Windows
# (macOS/Linux: source .venv/bin/activate)
.venv/Scripts/python -m uvicorn app:app --reload
```
Open http://127.0.0.1:8000 — `/styleguide` shows the design system.

## Test
```bash
.venv/Scripts/python -m pytest -q          # pure logic (focus.py, reminders.py)
python focus.py && python reminders.py     # inline self-checks
```

## Features
- **Timer** — Focus/Break/Deep presets + custom minutes, animated countdown ring, tweened
  digits; completed sessions logged to the DB; browser notification on finish.
- **Reminders** — custom (message + h/m) + the seed's quick presets (Study/Workout/Chill),
  once/daily/weekly recurrence, snooze; notifications fire while a tab is open.
- **Tasks** — a focus list; pick a task on the timer to log time against it.
- **Stats** — today's focus, day streak, totals, and an animated 7-day bar chart.

## Known ceilings
- Notifications fire only while a Focus tab is open (in-tab poll + `Notification` API).
  Closed-tab firing needs a service worker + Web Push + a server scheduler.
- Tailwind standalone (no purge/build); fonts via Google Fonts CDN — self-host to match the
  other projects if offline matters.

## Layout
`app.py` (routes + API) · `db.py` (SQLite) · `focus.py` / `reminders.py` (pure, tested logic) ·
`templates/` · `static/{css,js,vendor}` · `tests/`.
