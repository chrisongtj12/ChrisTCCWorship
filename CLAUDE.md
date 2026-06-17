# CLAUDE.md — TCC Worship Setlist Viewer

Auto-loaded context for Claude Code. Read `HANDOFF.md` for the full picture, `PRD - TCC Setlist Viewer.md` for the spec, `README.md` for usage.

## What this is
A static (no-backend) web app for preparing/leading worship at TCC. Holds each song's ChordPro
chart + TCC docx lyrics; build/share/perform setlists. Live at https://chris-tcc-worship.vercel.app
(Vercel auto-deploys `main`). Repo: chrisongtj12/ChrisTCCWorship.

## Stack
Vite + React 18 + TypeScript + Tailwind v3 (`darkMode: "class"`). lz-string for URL-encoded setlists.

## Commands
- `npm install`
- `npm run dev` — builds `public/songs.json` from `/songs`, then starts Vite
- `npm run build` — `build:songs` → `tsc -b` → `vite build` (use this to verify changes compile)

## Layout
- `songs/` — source `.cho/.txt/.chopro` charts + `.docx` lyrics (committed). `public/songs.json` is generated (gitignored).
- `scripts/build-songs.mjs` — compiles songs → `public/songs.json` (mammoth for docx).
- `src/lib/` — `chordpro.ts` (parse/transpose/Roman/sections), `song.ts`, `setlist.ts` (encode/save/export), `theme.ts`.
- `src/components/` — `App`, `LibraryView`, `SongView`, `ChartView`, `LyricsView`, `SetlistBuilder`, `SectionFlowEditor`, `SetlistViewer`, `ThemeToggle`, `ui`.

## Invariants (don't break)
- **The song chart/lyrics always render in full, natural order.** "Song order" is only a
  running-order REMINDER (a column in the play view), never a transform of the song.
- No backend: library = committed repo; setlists = lz-string URL hash (`#s=...`); prefs/saved sets = localStorage.
- Chart and TCC lyrics stay as separate toggleable views (wording differs).
- lz-string: import default then destructure (`import LZString from "lz-string"`).

## Workflow
Commit + push to deploy. If songs were edited on github.com, `git pull` before local edits.
Always run `npm run build` to confirm a change compiles before pushing.
