// AI chord <-> TCC-lyric merge (feature #2).
//
// For each song that has BOTH a chord chart and a TCC lyric sheet, ask Claude to
// place the chart's chords over the TCC wording (which often differs from the
// chart's own words) and write the result to songs/merged/<id>.cho. That file is
// committed; the normal build just reads it, so there is no per-deploy API cost.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-...  npm run merge            # merge songs missing a merged file
//   ANTHROPIC_API_KEY=...         npm run merge -- --force # re-merge everything
//   ANTHROPIC_API_KEY=...         npm run merge -- --id=a-mighty-fortress-is-our-god
//
// Run `npm run build:songs` first so public/songs.json is current.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MERGED_DIR = join(root, "songs", "merged");

const force = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--id="));
const onlyId = onlyArg ? onlyArg.slice("--id=".length) : null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY in the environment first.");
  process.exit(1);
}

const data = JSON.parse(readFileSync(join(root, "public", "songs.json"), "utf8"));
const client = new Anthropic();
mkdirSync(MERGED_DIR, { recursive: true });

const SYSTEM = `You merge a ChordPro chord chart with a separate lyric sheet for a worship song.

The chart has chords in [brackets] positioned over its OWN wording. The lyric sheet has the EXACT words the church actually sings, which sometimes differ from the chart (e.g. "You ask" vs "Dost ask", "Lord of hosts" vs "Lord Sabaoth").

Produce a single merged ChordPro chart where:
- The sung words are taken VERBATIM from the lyric sheet (never the chart's wording).
- The chart's chords are repositioned so each [chord] sits over the syllable it belongs on in the lyric-sheet wording. Use musical judgement when wording differs in length: keep the same harmonic rhythm, splitting or merging chord placements naturally.
- Keep every {comment: ...} section marker. Use the chart's section order. Copy chord-only sections (Intro, Turnaround, Instrumental, etc.) from the chart unchanged.
- Do NOT include {title}, {key}, {artist}, or other metadata directives — only {comment: ...} markers and the chord/lyric lines.

Output ONLY the merged ChordPro text. No explanation, no markdown code fences.`;

function lyricsToText(lyrics) {
  return lyrics.sections.map((s) => `[${s.label}]\n${s.lines.join("\n")}`).join("\n\n");
}

function stripFences(t) {
  return t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

let merged = 0;
for (const song of data.songs) {
  if (!song.choRaw || !song.lyrics) continue;
  if (onlyId && song.id !== onlyId) continue;
  const out = join(MERGED_DIR, song.id + ".cho");
  if (existsSync(out) && !force) {
    console.log(`skip (exists): ${song.title}`);
    continue;
  }
  process.stdout.write(`merging: ${song.title} … `);
  const prompt =
    `CHART (ChordPro — chords over the chart's own wording):\n${song.choRaw}\n\n` +
    `LYRIC SHEET (the exact words the church sings):\n${lyricsToText(song.lyrics)}`;

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  writeFileSync(out, stripFences(text) + "\n");
  merged++;
  console.log("done");
}

console.log(`\nMerged ${merged} song(s) into songs/merged/. Run \`npm run build\` to pick them up.`);
