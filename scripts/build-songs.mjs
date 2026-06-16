// Build step: compile /songs (*.cho + *.docx) into public/songs.json.
// Pairs each ChordPro chart with its TCC lyric sheet by fuzzy title match.
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
    const sec = t.match(/^\[(.+)\]$/);
    if (sec) {
      const label = sec[1].trim();
      if (IGNORE_SECTION.test(label)) continue;
      current = { label, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (title === null) title = t;
      continue;
    }
    current.lines.push(t);
  }
  for (const s of sections) {
    while (s.lines.length && s.lines[s.lines.length - 1] === "") s.lines.pop();
  }
  return { title, sections };
}

const files = readdirSync(SONGS_DIR);
const choFiles = files.filter((f) => extname(f).toLowerCase() === ".cho");
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
const songs = [];

for (const f of choFiles) {
  const raw = readFileSync(join(SONGS_DIR, f), "utf8");
  const cho = unwrap(raw);
  const title = getDirective(cho, "title") || basename(f, ".cho");
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

  songs.push({
    id: slugify(title),
    title,
    key: key || null,
    ccli: getDirective(cho, "ccli"),
    artist: getDirective(cho, "artist"),
    choRaw: cho,
    lyrics,
    sourceFiles: { cho: f, docx: lyrics ? best.file : null },
  });
}

for (const le of lyricEntries) {
  if (usedLyrics.has(le.file)) continue;
  const title = le.data.title || le.stem;
  songs.push({
    id: slugify(title),
    title,
    key: null,
    ccli: null,
    artist: null,
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
