import LZString from "lz-string";
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

export type View = "chart" | "lyrics";
export type Notation = "names" | "roman";

export type SetEntry = {
  songId: string;
  transpose: number; // semitones from original
  capo: number; // 0-7
  notation: Notation;
  view: View; // default view for this song in the set
  flow: string[] | null; // ordered section labels; null = natural order
};

export type Setlist = {
  name: string;
  date: string; // free text, e.g. "2026-06-21"
  entries: SetEntry[];
};

export function newEntry(songId: string): SetEntry {
  return { songId, transpose: 0, capo: 0, notation: "names", view: "chart", flow: null };
}

export function emptySetlist(): Setlist {
  return { name: "", date: "", entries: [] };
}

// --- compact wire format ---------------------------------------------------
// [songId, transpose, capo, notation(0|1), view(0|1), flow(string[]|0)]

type WireEntry = [string, number, number, 0 | 1, 0 | 1, string[] | 0];
type Wire = { n: string; d: string; e: WireEntry[] };

function toWire(set: Setlist): Wire {
  return {
    n: set.name,
    d: set.date,
    e: set.entries.map((x) => [
      x.songId,
      x.transpose,
      x.capo,
      x.notation === "roman" ? 1 : 0,
      x.view === "lyrics" ? 1 : 0,
      x.flow ?? 0,
    ]),
  };
}

function fromWire(w: Wire): Setlist {
  return {
    name: w.n ?? "",
    date: w.d ?? "",
    entries: (w.e ?? []).map((e) => ({
      songId: e[0],
      transpose: e[1] ?? 0,
      capo: e[2] ?? 0,
      notation: e[3] === 1 ? "roman" : "names",
      view: e[4] === 1 ? "lyrics" : "chart",
      flow: Array.isArray(e[5]) ? e[5] : null,
    })),
  };
}

/** Encode a setlist into a compact, URL-safe string for a share link. */
export function encodeSetlist(set: Setlist): string {
  return compressToEncodedURIComponent(JSON.stringify(toWire(set)));
}

/** Decode a share-link string back into a Setlist, or null if invalid. */
export function decodeSetlist(s: string): Setlist | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    return fromWire(JSON.parse(json) as Wire);
  } catch {
    return null;
  }
}

/** Build a full share URL for the current page + an encoded set. */
export function shareUrl(set: Setlist): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#s=${encodeSetlist(set)}`;
}

/** Read a shared setlist from the current URL hash, if present. */
export function setlistFromHash(): Setlist | null {
  const h = window.location.hash;
  const m = h.match(/^#s=(.+)$/);
  return m ? decodeSetlist(m[1]) : null;
}

// --- localStorage draft persistence ----------------------------------------

const DRAFT_KEY = "tcc.setlist.draft";

export function loadDraft(): Setlist | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Setlist) : null;
  } catch {
    return null;
  }
}

export function saveDraft(set: Setlist): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(set));
  } catch {
    /* ignore quota/unavailable */
  }
}

// --- named saved setlists (localStorage, per device) ------------------------

export type SavedSetlist = Setlist & { id: string; savedAt: number };

const SAVED_KEY = "tcc.setlist.saved";

export function loadSavedSets(): SavedSetlist[] {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeSaved(list: SavedSetlist[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Save (or overwrite by name) the current set; returns the updated list. */
export function saveNamedSet(set: Setlist): SavedSetlist[] {
  const list = loadSavedSets();
  const name = set.name.trim() || "Untitled set";
  const at = Date.now();
  const i = list.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
  const entry: SavedSetlist = {
    ...set,
    name,
    id: i >= 0 ? list[i].id : String(at),
    savedAt: at,
  };
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  list.sort((a, b) => b.savedAt - a.savedAt);
  writeSaved(list);
  return list;
}

export function deleteSavedSet(id: string): SavedSetlist[] {
  const list = loadSavedSets().filter((s) => s.id !== id);
  writeSaved(list);
  return list;
}
