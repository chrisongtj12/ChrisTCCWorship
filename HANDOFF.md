# Project handoff — TCC Worship Setlist Viewer

Context doc for continuing this project in **Claude Code** (or any editor) on another machine.
Read this first; it captures the what, why, architecture, conventions, and backlog.

## What this is

A web app for preparing and leading worship at The Crossing Church (TCC). It holds each
song's **ChordPro chart** (from CCLI SongSelect / Ultimate Guitar / Just Chords) and its
**TCC lyric sheet** (.docx), and lets you build/share/perform setlists.

- **Live:** https://chris-tcc-worship.vercel.app
- **Repo:** https://github.com/chrisongtj12/ChrisTCCWorship  (owner `chrisongtj12`, public)
- **Hosting:** Vercel, auto-deploys on push to `main`.
- **Stack:** Vite + React 18 + TypeScript + Tailwind (v3, `darkMode: "class"`). No backend.

## Run it locally (on the laptop)

```
git clone https://github.com/chrisongtj12/ChrisTCCWorship
cd ChrisTCCWorship
npm install
npm run dev          # builds songs.json from /songs, then starts Vite
```

Deploy = commit + push (Vercel rebuilds). If you also edit songs on github.com, run
`git pull` before local edits to avoid non-fast-forward rejects.

## How it works (architecture)

- **Songs live in `/songs`** as source files. A build step compiles them to `public/songs.json`.
  - Charts: `.cho`, `.txt`, `.chopro`, `.crd`, `.pro` (ChordPro; also unwraps Just Chords' JSON `{payload}` export).
  - Lyrics: `.docx` (TCC sheets).
  - `scripts/build-songs.mjs` (run via `npm run build:songs`, also part of `npm run build`):
    unwraps charts, reads directives (`{title}{key}{ccli}{artist}{tempo}{time}{comment}`),
    parses docx via **mammoth** (HTML route, to keep intra-paragraph line breaks),
    detects section headers (bracketed `[Verse 1]` AND unbracketed `VERSE 1`/`CHORUS`),
    pairs chart+lyrics by fuzzy title (spelling-insensitive: Savior/Saviour), dedupes by id,
    writes `public/songs.json`. `songs.json` is **gitignored** (regenerated each build).
- **`src/lib/chordpro.ts`** — ChordPro parser, transpose (key + capo, key-aware sharp/flat
  spelling), Roman-numeral conversion (e.g. `D/F#` → `V/vii`), `groupChartSections`.
- **`src/lib/song.ts`** — `availableSections(song)` (chart + lyric section labels, deduped).
- **`src/lib/setlist.ts`** — Setlist types + **lz-string** URL encode/decode (default import:
  `import LZString from "lz-string"`), localStorage draft, named saved sets, export/import codes.
  Wire format is a compact array per entry: `[songId, transpose, capo, notation, view, flow, note]`,
  plus an optional `shareId` (`i` in the wire) — a short unguessable id for the shared cue-notes
  store (see "Shared cue notes" below). `App.tsx` mints one once a draft has songs.
- **`src/lib/notes.ts`** — client for the shared cue-notes store; `fetchNotes`/`saveNote` call
  `/api/notes` and **degrade silently** (no endpoint / KV off → reads empty, writes no-op).
- **`api/notes.js`** — Vercel serverless function (GET/PUT) backing the shared notes, keyed by
  `shareId`, stored in Vercel KV / Upstash via its REST API (plain `fetch`, no npm dep).
- **`src/lib/theme.ts`** — Light / Dark / Stage theme (class on `<html>`; no-flash init in `index.html`).

### Components (`src/components`)
- `App.tsx` — shell: loads `songs.json`, Library/Setlist tabs, theme toggle; if URL hash is
  `#s=<code>` it renders the read-only **SetlistViewer** (the "Play"/share view).
- `LibraryView.tsx` — song list + search; discreet `+` adds a song to the set (stays on Library).
- `SongView.tsx` — one song: Chart/Lyrics toggle, **font A−/A+** (zoom, persisted), transpose,
  capo, Names/Roman, **tempo bar** (bold time sig, editable BPM per song, **metronome light**
  that flashes to the beat), and an editable **cue-notes** textarea (when `onNoteChange` given).
  Chart/lyrics always render FULL/natural order (the song is fixed).
- `ChartView.tsx` / `LyricsView.tsx` — render chart / lyrics (no reordering).
- `SetlistBuilder.tsx` — build a set: pointer drag-reorder, per-song key/capo/view/notation,
  **Order** editor (running-order reminder, drag handles), multi-line cue notes, save/new sets,
  **Export/Import** saved sets, **Copy share link**, **▶ Play set**.
- `SectionFlowEditor.tsx` — set the running-order REMINDER (does NOT change the chart).
- `SetlistViewer.tsx` — read-only performance view: song nav, **auto-scroll** (speed),
  **arrow-key / foot-pedal nav** (←/→, PageUp/Down) + **swipe** (horizontal, threshold +
  direction-locked so vertical scroll/selection is safe), **sticky Chart/Lyrics mode** that
  carries across songs (lifted here; `SongView` reports explicit toggles via `onViewChange`),
  **Wake Lock** to keep the screen awake (guarded; re-acquired on visibility),
  **Song order** column, editable cue
  notes (persist into the URL hash **and** sync via the shared store when `shareId` + KV are
  present), Print/PDF (all songs, ink-friendly), Stage theme.

## Key design decisions (don't re-litigate without reason)

1. **Song chart/lyrics are fixed** — always shown in full, natural order. The "song order"
   is only a REMINDER (a left column in the play view), never a transform of the chart.
2. **Almost no backend.** Library is the committed repo; setlists are URL-encoded (lz-string) so
   share links work with no login. Saved sets + preferences are localStorage (per device);
   Export/Import codes move them between devices. **One exception (E1):** *cue notes* can sync
   across everyone on a share link via a tiny serverless function + Vercel KV — see "Shared cue
   notes" below. It's notes-only and fully optional: the setlist itself still lives in the URL, so
   links keep working even if KV is off/down.
3. **Two views, not a merge** — chart and TCC lyrics stay separate (toggle), because TCC's
   wording/arrangement often differs from SongSelect.
4. **Google Drive live-pull was explicitly skipped** (OAuth/setup friction); songs are added
   manually into `/songs` (commit) or via GitHub web upload into the `songs/` folder.

## Conventions / gotchas
- Tailwind v3 with `darkMode: "class"`; theme classes `dark` / `stage` on `<html>`.
- Font scaling uses CSS `zoom` on the song body wrapper.
- lz-string must be imported as default then destructured (CJS interop).
- `node_modules/` and `public/songs.json` are gitignored.
- Build verifies with `npm run build` (runs `build:songs` → `tsc -b` → `vite build`).

## Shared cue notes (E1) + Vercel KV setup

Cue notes edited in the read-only Play view sync to everyone on the same share link.
How it works: each set carries a `shareId` inside its encoded code; the viewer GETs notes
on open (server overlays the link's notes) and PUTs on edit (debounced 600ms). Notes are
keyed by `songId`, so a note follows its song regardless of running order. Open-edit (no
login) — fine for the small team; protected by unguessable ids + size caps in `api/notes.js`.

**To turn it on (one-time, in the Vercel dashboard):**
1. Project → **Storage** → create a **KV** (Upstash Redis) store and connect it to this project.
2. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars. Redeploy.
3. That's it — the function reads those at runtime. **Until then it's a graceful no-op**
   (GET returns empty + `disabled:true`, PUT does nothing), so the app behaves exactly as
   before and nothing breaks. The "✎ cue notes save & sync…" hint only shows once KV is live.

Notes: not testable under `vite dev` (Vite doesn't serve `/api`) — verify on a Vercel preview.
Last-write-wins per song; no polling (loads on open). To move off Vercel KV later, repoint the
two `fetch` calls in `api/notes.js` at any Redis/KV REST endpoint.

## Backlog / ideas not yet built
- **Audible metronome** (Web Audio click) — currently visual light only.
- Auto-scroll: pause-on-manual-scroll, or per-song speed memory.
- Cue notes: richer formatting; show cue in the song-order column too.
- Setlist archive with clean dated URLs (`/set/2026-06-21`) vs URL-only.
- Capo: optional chord-shape diagrams (currently names only, by request).
- Nashville Number System strictness for non-diatonic chords.

## Status
All of Phases 0–4 plus extras are shipped and live: library, chart/lyrics/transpose/capo/Roman,
setlist builder (drag reorder, per-song settings, order reminder), saved sets + export/import,
share links, Play view (auto-scroll, pedal nav, font size, Stage theme), print/PDF, tempo bar
with editable BPM + metronome light, and multi-line cue notes.

See `PRD - TCC Setlist Viewer.md` for the original product spec and `README.md` for usage.
