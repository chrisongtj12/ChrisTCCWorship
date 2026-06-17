// Build step: compile /songs (charts + *.docx) into public/songs.json.
// Charts: .cho/.txt/.chopro/.crd/.pro (ChordPro). Lyrics: .docx (TCC sheets).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";

const root = fileURLToPath(new URL("..", import.meta.url));
const SONGS_DIR = join(root, "songs");
const OUT_DIR = join(root, "public");

function unwrap(raw) {
  const t = raw.trim();
  if (t.startsWith('{"')) {
    try {
      const obj = JSON.parse(t);
      if (typeof obj.payload === "string") return obj.payload;
    } catch {}
  }
  return raw;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Deduped token set; collapses British spellings (saviour -> savior).
function tokenSet(s) {
  const tokens = s
    .toLowerCase()
    .replace(/\btcc\b|\blyrics\b|\bchords?\b|\bchordpro\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/our$/, "or"));
  return new Set(tokens);
}

function isSubset(a, b) {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
function overlap(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function getDirective(cho, name) {
  const m = cho.match(new RegExp("\\{\\s*" + name + "\\s*:\\s*(.*?)\\s*\\}", "i"));
  return m ? m[1].trim() : null;
}

// docx -> plain text, preserving intra-paragraph <br/> line breaks.
async function docxToText(path) {
  const { value: html } = await mammoth.convertToHtml({ path });
  let t = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return t;
}

const IGNORE_SECTION = /^(more below|continued|cont'd|next|end)$/i;

// A line is a section header if bracketed [..] OR an unbracketed keyword line
// (e.g. "VERSE 1", "CHORUS", "PRE-CHORUS"). Returns a normalized label or null.
const SECTION_RE =
  /^(verse|chorus|pre[\s-]?chorus|prechorus|bridge|intro|outro|interlude|instrumental|turnaround|vamp|tag|refrain|ending|coda|hook|reprise)\b[\s.]*\d*[a-z]?\s*:?$/i;
function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}
function detectSection(t) {
  const b = t.match(/^\[(.+)\]$/);
  if (b) return b[1].trim();
  if (SECTION_RE.test(t)) return titleCase(t.replace(/:\s*$/, "").trim());
  return null;
}

function parseLyrics(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  const sections = [];
  let title = null;
  let current = null;
  for (const line of lines) {
    const t = line.trim();
    if (t === "") {
      if (current) current.lines.push("");
      continue;
    }
    const label = detectSection(t);
    if (label !== null) {
      if (IGNORE_SECTION.test(label)) continue;
      current = { label, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (title === null) title = t; // first pre-section line = title
      continue;
    }
    current.lines.push(t);
  }
  for (const s of sections) {
    while (s.lines.length && s.lines[s.lines.length - 1] === "") s.lines.pop();
  }
  return { title, sections };
}

const CHART_EXTS = new Set([".cho", ".txt", ".chopro", ".crd", ".pro"]);

const files = readdirSync(SONGS_DIR);
const choFiles = files
  .filter((f) => CHART_EXTS.has(extname(f).toLowerCase()))
  .sort(); // .cho sorts before .chopro, so it wins on duplicate titles
const docxFiles = files.filter((f) => extname(f).toLowerCase() === ".docx" && !f.startsWith("~$"));

const lyricEntries = [];
for (const f of docxFiles) {
  const text = await docxToText(join(SONGS_DIR, f));
  const parsed = parseLyrics(text);
  lyricEntries.push({
    file: f,
    stem: basename(f, ".docx"),
    tokens: tokenSet(basename(f, ".docx")),
    titleTokens: parsed.title ? tokenSet(parsed.title) : new Set(),
    data: parsed,
  });
}

const usedLyrics = new Set();
const seenIds = new Set();
const songs = [];

for (const f of choFiles) {
  const raw = readFileSync(join(SONGS_DIR, f), "utf8");
  const cho = unwrap(raw);
  const title = getDirective(cho, "title") || basename(f, extname(f));
  const id = slugify(title);
  if (seenIds.has(id)) continue; // skip duplicate chart (e.g. .cho + .chopro)
  const key = getDirective(cho, "key");
  const choTokens = tokenSet(title);

  let best = null;
  let bestScore = -1;
  for (const le of lyricEntries) {
    if (usedLyrics.has(le.file)) continue;
    let score = -1;
    for (const ct of [le.tokens, le.titleTokens]) {
      if (ct.size === 0) continue;
      const sub = isSubset(ct, choTokens) || isSubset(choTokens, ct);
      const s = (sub ? 100 : 0) + overlap(ct, choTokens);
      if (s > score) score = s;
    }
    if (score > bestScore) {
      bestScore = score;
      best = le;
    }
  }

  let lyrics = null;
  if (best && bestScore >= 2) {
    lyrics = best.data;
    usedLyrics.add(best.file);
  }

  seenIds.add(id);
  songs.push({
    id,
    title,
    key: key || null,
    ccli: getDirective(cho, "ccli"),
    artist: getDirective(cho, "artist"),
    tempo: getDirective(cho, "tempo"),
    time: getDirective(cho, "time"),
    choRaw: cho,
    lyrics,
    sourceFiles: { cho: f, docx: lyrics ? best.file : null },
  });
}

for (const le of lyricEntries) {
  if (usedLyrics.has(le.file)) continue;
  const title = le.data.title || le.stem;
  const id = slugify(title);
  if (seenIds.has(id)) continue;
  seenIds.add(id);
  songs.push({
    id,
    title,
    key: null,
    ccli: null,
    artist: null,
    tempo: null,
    time: null,
    choRaw: null,
    lyrics: le.data,
    sourceFiles: { cho: null, docx: le.file },
  });
}

songs.sort((a, b) => a.title.localeCompare(b.title));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "songs.json"),
  JSON.stringify({ songs, builtAt: new Date().toISOString() }, null, 2)
);

console.log(`Built ${songs.length} song(s):`);
for (const s of songs) {
  console.log(
    `  - ${s.title}  [key ${s.key ?? "?"}]  chart:${s.choRaw ? "yes" : "no"}  lyrics:${
      s.lyrics ? s.lyrics.sections.length + " sections" : "no"
    }`
  );
}
