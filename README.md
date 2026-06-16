# TCC Worship Setlist Viewer

A web app for preparing and leading worship at TCC. Holds each song's **ChordPro chart** (from CCLI SongSelect / Ultimate Guitar / Just Chords) and its **TCC lyric sheet** (docx), with transpose, capo, and Roman-numeral views. Built to deploy free on Vercel from a public GitHub repo. See `PRD - TCC Setlist Viewer.md` for the full design.

**Status:** Phase 0 — song viewer (chart + lyrics, transpose, capo, notation toggle). Setlist builder and share links come in later phases.

## Add a song

Drop files into the `songs/` folder, then rebuild:

- **Chart:** a `.cho` file — standard ChordPro *or* a Just Chords export (the JSON-wrapped kind both work).
- **Lyrics:** the TCC `.docx` lyric sheet. Sections must be marked like `[Verse 1]`, `[Chorus]`.

Charts and lyrics are paired automatically by title (spelling-insensitive, so *Savior/Saviour* and shortened titles still match). A song can have just a chart, just lyrics, or both.

## Run locally

```bash
npm install
npm run dev        # builds songs.json from /songs, then starts Vite
```

Open the printed localhost URL.

## Build / deploy

```bash
npm run build      # regenerates songs.json, type-checks, bundles to dist/
```

Push to GitHub and import the repo in Vercel — it auto-detects Vite and runs `npm run build`. `public/songs.json` is generated at build time from `songs/`, so you never commit it; just commit the song files.

## How it works

- `scripts/build-songs.mjs` reads `songs/`, unwraps Just Chords JSON, extracts chart metadata, parses each docx (via mammoth) into titled sections, pairs them, and writes `public/songs.json`.
- `src/lib/chordpro.ts` parses ChordPro, transposes (key + capo, key-aware sharp/flat spelling), and converts chords to Roman numerals (e.g. `D/F#` → `V/vii`).
- The app loads `songs.json` and renders the chart or lyric view per song.

## Notes

- `node_modules/` and `public/songs.json` are gitignored.
- The repo is intended to be public (limited team viewership). Charts are used under your CCLI licence; keep distribution limited to the worship team.
