# Khaata (BudgetApp) — Build Phases

How the app was created, reconstructed from git history. Stack: **Python / Flask**.
Indian expense tracker — income & expenses by category, in ₹ with `DD-MM-YYYY` dates.
Per-account data kept under `data/<username>/`, decoupled from the app.

## Phases (in build order)
1. **UI design canvas** — reimagined UI drafted as a design canvas.
2. **Typography** — whole canvas set in Cousine (monospace).
3. **Palette** — recolored onto the "Ledger" Tailwind-token palette.
4. **Dark mode** — canvas converted to dark-only.
5. **Flask web app** — built the reimagined UI as a working Flask app.
6. **Multi-user auth** — sign up / log in / log out.
7. **Hardening** — tightened date parsing and auth redirects; added tests + screenshots.

See [[README|Khaata README]].
