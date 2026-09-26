# Focus — Project Status & Resume Plan

_Last updated: 2026-09-01. Read this first when resuming._

> **Current state:** Phases 0–5 built in one pass and verified green — `pytest`
> (11 tests, `focus.py` + `reminders.py`), inline self-checks, an end-to-end
> TestClient smoke (pages + task/session/stats/reminder flows), and a live
> `uvicorn` boot serving all pages + vendored static + `/api/stats`. Dev server
> runs on **:8000**. **Remaining / deferred:** closed-tab notifications (service
> worker + Web Push), self-hosted fonts, a real browser visual-QA pass.

A motion-first focus webapp — Pomodoro timer, reminders, focus tasks, streak/stat
tracking — grown from the `RemainderApplication-main` seed. Python backend, one
process, no build step, reusing the prior projects' design language.

---

## 1. Locked-in decisions (do not re-litigate)
- **Backend:** FastAPI + Jinja2, server-rendered pages + a small JSON API. Run with `uvicorn`.
- **Persistence:** SQLite (`focus.db`), **single-user, no auth**. Schema in `db.py`.
- **Frontend:** Tailwind standalone (vendored `static/vendor/tailwind.js`, configured inline in
  `base.html`) + anime.js v4 (vendored `static/vendor/anime.esm.js`). No build step.
- **Design tokens:** ported from `ciba_library/src/app/globals.css` → `static/css/tokens.css`;
  accent swapped to the seed's coral `#FF5733` (hue ~12). Light **and** dark, reduced-motion respected.
- **Motion:** vocabulary ported from `ciba_library/src/lib/motion.ts` → `static/js/motion.js`
  (vanilla). Signature motion: countdown ring, number tweening, staggered card entrances.
- **Pure logic isolated & tested:** `focus.py` (streak/totals/series), `reminders.py`
  (recurrence/due/snooze) — no DB, no framework.

## 2. Phase status
| Phase | What | Status |
|------|------|--------|
| 0 | Scaffold — FastAPI + Jinja + SQLite + vendored Tailwind/anime, base layout, theme toggle | ✅ Done |
| 1 | Motion system + `/styleguide` (tokens.css, motion.js helpers, reduced-motion) | ✅ Done |
| 2 | Focus timer — presets + custom, animated ring + digits, session logging, notification | ✅ Done |
| 3 | Reminders — custom + seed presets + recurrence + snooze, in-tab notifications | ✅ Done |
| 4 | Focus tasks — list + toggle/delete, link a session to a task | ✅ Done |
| 5 | History & stats + polish + tests — tiles, streak, animated 7-day chart, pytest | ✅ Done |

## 3. Verify (green)
`cd RemainderApplication-main` then:
- `.venv/Scripts/python -m pytest -q` → 11 passed.
- `.venv/Scripts/python -m uvicorn app:app --reload` → http://127.0.0.1:8000; `/styleguide` shows the system.
- Timer: start a 1-min focus → ring animates, digits tween, session logged, notification at 0.
- Reminders: preset/custom fires (tab open); daily re-arms; snooze +10m; blank rejected.
- Stats: today's focus + streak + animated bars reflect logged sessions.

## 4. Next up (deferred)
1. **Closed-tab notifications** — service worker + Web Push + a server scheduler (APScheduler);
   today it's an in-tab 15s poll in `base.html`.
2. **Self-host fonts** (Inter / JetBrains Mono / Newsreader) like the other projects; currently Google Fonts CDN.
3. **Browser visual-QA pass** — needs the Chrome extension connected.

See [[Build-Phases]] and [[README]].
