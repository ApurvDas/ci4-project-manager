# Focus — Build Phases

How the app was created. Stack: **FastAPI + Jinja + SQLite (Python)**, Tailwind +
anime.js frontend, no build step. Seed: `RemainderApplication-main` (a ~75-line
tkinter desktop reminder app — its 3 quick presets carry into Phase 3).

## Phases (in build order)
0. **Scaffold** — FastAPI app serving Jinja pages + a JSON API; SQLite schema (`db.py`);
   vendored Tailwind + anime.js; `base.html` with nav, light/dark theme toggle, FOUC guard.
1. **Motion system + `/styleguide`** — ported design tokens (`static/css/tokens.css`) and the
   motion vocabulary (`static/js/motion.js`: durations/eases/springs/stagger + `reveal`,
   `animatedNumber`, `springPress`, `staggerIn`) from `ciba_library`; reduced-motion guard.
2. **Focus timer** — Focus/Break/Deep presets + custom minutes; animated SVG countdown ring +
   tweened digits; completed sessions logged to the DB; browser notification on finish.
3. **Reminders** — custom (message + h/m) + the 3 seed quick presets; once/daily/weekly
   recurrence + snooze; an in-tab 15s poller fires due reminders as notifications on any page.
4. **Focus tasks** — add/toggle/delete a focus list; a session can be attached to a task from the timer.
5. **History & stats + tests** — dashboard tiles (today, streak, sessions, total), an animated
   7-day bar chart; pure logic (`focus.py`, `reminders.py`) covered by `pytest` (11 tests).

## Design & motion reuse
- Tokens: `ciba_library/src/app/globals.css` → `static/css/tokens.css`, accent swapped to the
  seed's coral `#FF5733`. Light + dark.
- Motion: `ciba_library/src/lib/motion.ts` values → vanilla `static/js/motion.js` (anime.js v4).

## Known ceilings
- **Notifications only while a tab is open** — closed-tab firing needs a service worker + Web Push.
- Tailwind standalone (no build); fonts via Google Fonts CDN.

See [[PROJECT_STATUS]] and [[README]].
