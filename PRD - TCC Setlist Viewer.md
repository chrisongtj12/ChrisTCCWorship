# PRD — TCC Worship Setlist Viewer

*Owner: Chris · Draft v1.1 · 16 Jun 2026 · Status: open questions resolved — ready to build*

---

## 1. Problem

Preparing and leading worship at TCC means juggling two mismatched sources per song:

- **ChordPro charts** (`.cho`) downloaded from SongSelect/CCLI or Ultimate Guitar — these carry chords, key, and SongSelect's wording.
- **TCC lyric sheets** (`.docx`) from the centralised Google Drive — these carry TCC's actual wording and arrangement (which often *differs* from SongSelect), but no chords.

The wording and section order genuinely diverge between the two. For example, in *A Mighty Fortress* SongSelect has "Dost ask who that may be" whilst TCC sings "You ask who that may be"; *His Mercy Is More* places the chorus differently. Today there's no single place to hold both, build a Sunday setlist, transpose to the band's key, and share the running order with the team. Just Chords does the chart side well but doesn't hold TCC's lyric versions or produce a shareable team setlist.

## 2. Goals & success criteria

The app succeeds if:

1. I can upload a song's `.cho` and TCC `.docx` and view either the **chord chart** or the **TCC lyric sheet** for that song, toggling between them.
2. I can transpose any song and set a capo, and the chart updates correctly.
3. I can assemble songs into an ordered setlist, reorder them, and set each song's arrangement/section flow (e.g. V1–C–V2–C–Bridge–C).
4. I can produce a **read-only share link** the worship team opens on their phones — no login — showing the set in order with both views available per song.
5. The whole thing deploys to Vercel from a GitHub repo and stays free to run.

## 3. Non-goals (v1)

- No live Google Drive sync — upload is manual drag-and-drop (your decision).
- No automatic merge of chords onto TCC wording — the two stay as separate toggleable views (your decision). This sidesteps the hard alignment problem.
- No multi-user accounts, editing permissions, or real-time collaboration.
- No audio playback, click track, or auto-scroll in v1 (can revisit).
- No CCLI reporting/usage logging.

## 4. Users & roles

| Role | Who | Can |
|---|---|---|
| **Editor** | You (Chris) | Upload songs, build/edit setlists, transpose, set arrangements, generate share links. |
| **Viewer** | Worship + sound team | Open a share link, read songs in set order, toggle chart/lyrics, transpose *locally* on their own device. No edits saved. |

## 5. Core design decisions (the tricky bits)

**5.1 Two views, not a merge.** Each song holds a ChordPro chart *and* a TCC lyric sheet as separate documents. A toggle switches between them. No risky auto-alignment of chords onto differing wording. If wording conflicts, the TCC lyric sheet is the source of truth for *what is sung*; the chart is the source of truth for *chords/key*.

**5.2 Library lives in the GitHub repo — this is what makes login-free share links work.** Since there's no backend and no login, the team's browser must be able to fetch song data from somewhere public. The clean answer: committed song files in the repo, served as static data by Vercel. Your manual uploads either (a) get dropped into the repo's `/songs` folder, or (b) go through the app's in-browser uploader, which parses them and hands you a ready-to-commit JSON file. A build step compiles everything into one `songs.json` the app loads.

**5.3 Setlists are encoded in the share URL — instant, no redeploy.** A setlist is just an ordered list of song IDs plus per-song settings (key offset, capo, section flow). That's tiny, so it compresses into the URL itself (e.g. `/set#<compressed-state>`). You build a set, hit Share, send the link — the team opens it immediately, no commit or redeploy needed. Optionally a set can also be saved to the repo for a permanent clean URL (`/set/2026-06-21`).

**5.4 Parsing.** The parser accepts **both** raw/standard ChordPro (as downloaded from CCLI SongSelect or Ultimate Guitar) **and** Just Chords exports (standard ChordPro inside a JSON `{payload}` wrapper). It auto-detects the wrapper, strips it if present, then reads ChordPro directives (`{title}`, `{key}`, `{comment: Verse 1}`) and inline `[chord]` tokens. `.docx` lyric sheets are parsed (via mammoth.js) into titled sections keyed off the `[Verse 1]` / `[Chorus]` markers. Transposition operates on parsed chord tokens, so capo and key changes are reliable, including slash chords (`A/C#`) and suspensions seen in your files.

**5.5 Chord notation modes.** The chart view offers two display modes the user toggles: **chord names** (e.g. `G`, `D/F#`, `Em7`) and **Roman numeral** view (e.g. `I`, `V/vii`, `vi7`) computed relative to the current effective key, using case to mark quality (uppercase major, lowercase minor). No fretboard shapes — chord *name* only when capo is set (capo shifts the printed key, not a shapes diagram).

## 6. Scope — feature list (v1)

**Song library**
- Drag-drop upload of `.cho` and `.docx`; auto-pair by song title; manual pair override.
- Song list with search; each song shows title, key, CCLI #, which sources it has.
- Per-song view with **Chart ⇄ Lyrics** toggle.

**Chart view**
- Rendered ChordPro: section labels, chords above lyrics, monospace alignment.
- Transpose ±semitones; capo selector (prints chord names relative to capo); reset to original key.
- Notation toggle: **chord names ⇄ Roman numerals** (relative to current key).

**Lyric view**
- TCC wording rendered by section, large readable type.

**Setlist builder**
- Add songs to a set; drag to reorder; per-song key/capo; per-song section flow editor (pick/duplicate/reorder sections like V1–C–V2–C–Bridge–C).
- Share button → copyable read-only link.

**Viewer (shared link)**
- Set list with order; tap a song to open; Chart/Lyrics toggle; local transpose; next/prev navigation between songs.

## 7. Proposed tech

- **Next.js (App Router) + TypeScript**, deployed to **Vercel** from **GitHub** — Vercel-native, free tier, clean routing for `/song/[id]` and `/set` links.
- **Tailwind** for styling, high-contrast theme.
- **mammoth.js** (docx → structured text) and a small custom ChordPro parser/transposer, both runnable at build time (Node) and in-browser.
- Library compiled to static `songs.json`; setlists URL-encoded (lz-string compression).
- No database in v1.

## 8. Phased plan

1. **Phase 0 — repo & parsers.** Scaffold Next.js repo, build the ChordPro parser/transposer and docx parser, compile your 3 existing songs into `songs.json`. *Deliverable: songs render correctly in chart + lyric views.*
2. **Phase 1 — song viewer + transpose/capo.** Single-song page with toggle, transpose, capo. *Deliverable: usable on your phone.*
3. **Phase 2 — setlist builder + share links.** Build/reorder sets, section-flow editor, generate share URL, viewer mode. *Deliverable: end-to-end Sunday workflow.*
4. **Phase 3 — deploy + polish.** Vercel deploy, in-app uploader that emits commit-ready JSON, search, mobile polish.
5. **Later (post-v1):** auto-scroll, dark/stage theme, optional Google Drive pull, PDF/print export.

## 9. Decisions (resolved)

1. **Setlist permanence** → URL-encoded share links for instant weekly sharing (Phase 2), plus an optional manually-committed `/sets/*.json` archive with clean dated URLs (Phase 3). App will *not* auto-write to GitHub.
2. **Uploads** → drop `.cho`/`.docx` straight into the `/songs` folder; build step parses them. No in-app uploader needed for v1.
3. **Chords** → chord *names* only (no fretboard shapes), with a **Roman numeral** notation toggle relative to the current key.
4. **Repo visibility** → public repo is fine (viewership limited to ~4 team members).
5. **Key** → stored **per-setlist-entry**. Same song can sit in different keys/capos on different Sundays.
6. **Parser input** → accepts both standard ChordPro (CCLI/Ultimate Guitar) and Just Chords JSON-wrapped exports.

## 10. Risks

- **CCLI content hosting.** Committing SongSelect charts to a public repo may sit awkwardly with SongSelect Terms of Use. Mitigation: private repo + access-controlled deploy, or keep charts out of git and load them only client-side from your own upload. Flagged for your call (Q4) — you hold the CCLI licence (#301143) so usage is covered, but *public redistribution* is the concern.
- **docx variability.** TCC sheets aren't perfectly structured (stray blank lines, inconsistent section tags seen in samples). Parser must be forgiving and allow manual section fix-up.
- **URL length** if a set grows very large — mitigated by compression; fall back to repo-saved sets if needed.
