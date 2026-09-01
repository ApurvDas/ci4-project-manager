# Vault Organization — Plan & Process

How this folder was turned into a usable Obsidian vault, and the phases it went through.

## Context / problem
`level-1` had been opened as an Obsidian vault (`.obsidian/` present) but actually held
three live code projects. Obsidian indexes every `.md` in the tree — **1,569 markdown
files, of which only 8 were real notes**; the other 1,561 were dependency READMEs inside
`node_modules/`, `.venv/`, `vendor/`, `.next/`, etc. Real notes were drowned in search and
the graph, and `.obsidian/app.json` was empty (`{}` — nothing excluded).

Goal: a clean notes vault where only curated notes are indexed, without touching or
breaking the three code projects.

## Chosen approach
Non-destructive: **config + index + gather copies into `/Notes`**. No project source
moved (repos stay runnable). Real docs copied into a curated `Notes/` area; code folders
excluded from Obsidian's index so there are no duplicate/junk notes.

## Phases

### Phase 1 — Understand
Mapped the folder. Found three projects — Khaata (Python), Ciba Library (Next.js),
Project Manager (PHP CodeIgniter) — plus the `.obsidian/` config. Counted markdown:
1,569 total vs 8 real. Confirmed no loose files at root and that `app.json` had no
exclusions.

### Phase 2 — Design
Two options weighed: (A) config + index only, vs (B) config + index + gather note copies
into `/Notes`. Key insight: excluding the three project roots *wholesale* (not just
`node_modules`) avoids duplicate notes, since the `/Notes` copies become the only indexed
view of each project's docs.

### Phase 3 — Decide
Asked which scope to take. Chosen: **option B** — gather copies into `/Notes`, originals kept.

### Phase 4 — Execute
1. Created `Notes/<Project>/` and copied the 7 real docs (font-license README skipped).
2. Wrote `.obsidian/app.json` with `userIgnoreFilters` for the three project roots +
   tooling dirs (`.claude/`, `.codex/`, `.impeccable/`, `.playwright-mcp/`).
3. Created [[Home]] as the map-of-content entry point, using full-path wikilinks so the
   three same-named READMEs stay unambiguous.

### Phase 5 — Verify
Indexed notes dropped from 1,569 → **8** (Home + 7 curated). `app.json` validated as JSON.
No project files modified.

## Files created / modified
- `.obsidian/app.json` — exclude filters (was `{}`)
- `Notes/**` — 7 copied notes across 3 subfolders + this note
- `Home.md` — vault entry point
- No changes inside the three project folders.

## Known ceiling
`Notes/` holds **copies**, so they drift if the originals change — re-copy when that
happens, or add a sync script only if it becomes a chore.
