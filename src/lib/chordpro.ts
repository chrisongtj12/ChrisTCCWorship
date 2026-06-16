// ChordPro parser, transposer, capo + Roman-numeral engine.
// Pure logic, no DOM — usable in the browser and in Node build scripts.

export type ChordToken = {
  /** Original chord text as written, e.g. "D/F#", "Am7", "A2sus/B" */
  raw: string;
  rootPc: number; // pitch class 0-11 of root
  quality: string; // extension/quality string after the root, before any slash, e.g. "m7", "sus"
  bassPc: number | null; // pitch class of bass note if slash chord
  bassRaw: string | null; // bass note text e.g. "F#"
};

export type LineSegment = { chord: ChordToken | null; text: string };
export type SongLine =
  | { type: "section"; label: string }
  | { type: "lyric"; segments: LineSegment[] }
  | { type: "blank" }
  | { type: "text"; text: string }; // misc non-directive text (e.g. CCLI footer)

export type ChordChart = {
  meta: Record<string, string>;
  title: string;
  key: string | null;
  lines: SongLine[];
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, "E#": 5, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// Keys that conventionally spell with flats.
const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm",
]);

function normalizeNoteName(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse a chord string like "D/F#" or "Am7" into a ChordToken. Returns null if not a chord. */
export function parseChord(raw: string): ChordToken | null {
  const m = raw.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return null;
  const root = normalizeNoteName(m[1]);
  if (!(root in NOTE_TO_PC)) return null;
  const quality = m[2] || "";
  const bass = m[3] ? normalizeNoteName(m[3]) : null;
  return {
    raw,
    rootPc: NOTE_TO_PC[root],
    quality,
    bassPc: bass ? NOTE_TO_PC[bass] : null,
    bassRaw: bass,
  };
}

function spellPc(pc: number, useFlats: boolean): string {
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

function keyUsesFlats(key: string | null): boolean {
  if (!key) return false;
  return FLAT_KEYS.has(key.trim());
}

/** Transpose a key string by semitones (returns spelled key, preserving trailing 'm'). */
export function transposeKey(key: string, semitones: number): string {
  const m = key.trim().match(/^([A-G][#b]?)(m(?:in)?)?$/);
  if (!m) return key;
  const isMinor = !!m[2];
  const pc = NOTE_TO_PC[normalizeNoteName(m[1])];
  const newPc = (((pc + semitones) % 12) + 12) % 12;
  // Decide flats/sharps based on the destination key itself.
  const sharpName = spellPc(newPc, false) + (isMinor ? "m" : "");
  const flatName = spellPc(newPc, true) + (isMinor ? "m" : "");
  return FLAT_KEYS.has(flatName) ? flatName : sharpName;
}

/** Render a ChordToken as a chord name, transposed by `semitones`, spelled per `effectiveKey`. */
export function chordToName(tok: ChordToken, semitones: number, effectiveKey: string | null): string {
  const useFlats = keyUsesFlats(effectiveKey);
  const root = spellPc(tok.rootPc + semitones, useFlats);
  const bass = tok.bassPc === null ? "" : "/" + spellPc(tok.bassPc + semitones, useFlats);
  return root + tok.quality + bass;
}

// ---- Roman numeral engine -------------------------------------------------

const MAJOR_DEGREE: Record<number, string> = {
  0: "I", 2: "II", 4: "III", 5: "IV", 7: "V", 9: "VI", 11: "VII",
};
// Chromatic degrees -> conventional spelling (flat-side, except #IV for tritone).
const CHROMATIC_DEGREE: Record<number, string> = {
  1: "bII", 3: "bIII", 6: "#IV", 8: "bVI", 10: "bVII",
};
// Diatonic default quality in a major key, for casing bass notes.
const DIATONIC_IS_MINOR = new Set([2, 4, 9, 11]); // ii iii vi vii (vii treated lowercase)

function degreeNumeral(pc: number, tonicPc: number): { numeral: string; diatonic: boolean; interval: number } {
  const interval = (((pc - tonicPc) % 12) + 12) % 12;
  if (interval in MAJOR_DEGREE) return { numeral: MAJOR_DEGREE[interval], diatonic: true, interval };
  return { numeral: CHROMATIC_DEGREE[interval], diatonic: false, interval };
}

function chordIsMinor(quality: string): boolean {
  return /^(m|min)(?!aj)/.test(quality);
}
function chordIsDim(quality: string): boolean {
  return /^(dim|°|o)/.test(quality) || /m7b5|m7-5/.test(quality);
}
function chordIsAug(quality: string): boolean {
  return /^(aug|\+)/.test(quality);
}

/** Strip the leading minor marker from a quality so it isn't doubled with lowercase casing. */
function qualitySuffix(quality: string): string {
  if (chordIsDim(quality)) return quality.replace(/^dim/, "").replace(/^°/, "").replace(/^o/, "") + "°".replace("°°", "");
  if (chordIsMinor(quality)) return quality.replace(/^(min|m)/, "");
  return quality;
}

/** Render a ChordToken as a Roman numeral relative to `effectiveKey` (already transposed). */
export function chordToRoman(tok: ChordToken, semitones: number, effectiveKey: string | null): string {
  if (!effectiveKey) return "?";
  const keyMatch = effectiveKey.trim().match(/^([A-G][#b]?)(m(?:in)?)?$/);
  if (!keyMatch) return "?";
  const tonicPc = NOTE_TO_PC[normalizeNoteName(keyMatch[1])];

  const rootPc = (tok.rootPc + semitones) % 12;
  const { numeral } = degreeNumeral(rootPc, tonicPc);
  let n = numeral;
  if (chordIsMinor(tok.quality) || chordIsDim(tok.quality)) n = n.toLowerCase();
  // chromatic accidental letters stay as written; ensure case applies only to roman letters
  if (chordIsMinor(tok.quality) || chordIsDim(tok.quality)) {
    n = n.replace(/[IV]+/g, (s) => s.toLowerCase());
  }
  let suffix = qualitySuffix(tok.quality);
  if (chordIsDim(tok.quality) && !suffix.includes("°")) suffix = "°" + suffix;
  if (chordIsAug(tok.quality)) suffix = suffix; // keep aug/+ text

  let out = n + suffix;

  if (tok.bassPc !== null) {
    const bassPc = (tok.bassPc + semitones) % 12;
    const bd = degreeNumeral(bassPc, tonicPc);
    let bn = bd.numeral;
    // case bass numeral by diatonic default quality
    if (bd.diatonic && DIATONIC_IS_MINOR.has(bd.interval)) bn = bn.replace(/[IV]+/g, (s) => s.toLowerCase());
    out += "/" + bn;
  }
  return out;
}

// ---- Parsing --------------------------------------------------------------

/** Unwrap a Just Chords JSON export if present; otherwise return text as-is. */
export function unwrapSource(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('{"')) {
    try {
      const obj = JSON.parse(t);
      if (typeof obj.payload === "string") return obj.payload;
    } catch {
      /* not JSON-wrapped */
    }
  }
  return raw;
}

const DIRECTIVE_RE = /^\{\s*([a-zA-Z_]+)\s*:?\s*(.*?)\s*\}$/;

export function parseChordPro(rawInput: string): ChordChart {
  const source = unwrapSource(rawInput).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const meta: Record<string, string> = {};
  const lines: SongLine[] = [];

  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim() === "") {
      lines.push({ type: "blank" });
      continue;
    }
    const dir = line.trim().match(DIRECTIVE_RE);
    if (dir) {
      const name = dir[1].toLowerCase();
      const value = dir[2];
      if (name === "comment" || name === "c") {
        lines.push({ type: "section", label: value });
      } else {
        // collect repeated artist lines too
        meta[name] = meta[name] ? meta[name] + " | " + value : value;
      }
      continue;
    }
    if (line.includes("[")) {
      lines.push({ type: "lyric", segments: parseLyricLine(line) });
    } else {
      lines.push({ type: "text", text: line });
    }
  }

  return {
    meta,
    title: meta.title || "Untitled",
    key: meta.key ? meta.key.trim() : null,
    lines,
  };
}

function parseLyricLine(line: string): LineSegment[] {
  const segments: LineSegment[] = [];
  const re = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let pendingChord: ChordToken | null = null;
  let m: RegExpExecArray | null;
  // Text before the first chord (anacrusis)
  while ((m = re.exec(line)) !== null) {
    const text = line.slice(lastIndex, m.index);
    if (pendingChord !== null || text.length > 0 || segments.length === 0) {
      segments.push({ chord: pendingChord, text });
    } else {
      segments.push({ chord: pendingChord, text });
    }
    pendingChord = parseChord(m[1].trim());
    lastIndex = re.lastIndex;
  }
  const tail = line.slice(lastIndex);
  segments.push({ chord: pendingChord, text: tail });
  // Drop a leading empty no-chord segment
  if (segments.length && segments[0].chord === null && segments[0].text === "") {
    segments.shift();
  }
  return segments;
}
