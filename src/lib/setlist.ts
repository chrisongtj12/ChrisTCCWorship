import LZString from "lz-string";
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;

export type View = "chart" | "lyrics";
export type Notation = "names" | "roman";

export type SetEntry = {
  songId: string;
  transpose: number;
  capo: number;
  notation: Notation;
  view: View;
  flow: string[] | null; // running-order reminder; null = natural
  note: string; // free-text cue, e.g. "start a cappella"
  role: string; // service slot label, e.g. "Opening Song" (services only; "" for ad-hoc sets)
};

export type Setlist = {
  name: string;
  date: string;
  entries: SetEntry[];
  // Short, unguessable id for the shared cue-notes store (E1). Travels inside
  // the encoded share code, so a given share link maps to one notes locker.
  shareId?: string;
};

export function makeShareId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

export function ensureShareId(set: Setlist): Setlist {
  return set.shareId ? set : { ...set, shareId: makeShareId() };
}

export function newEntry(songId: string): SetEntry {
  return { songId, transpose: 0, capo: 0, notation: "names", view: "chart", flow: null, note: "", role: "" };
}

export function emptySetlist(): Setlist {
  return { name: "", date: "", entries: [] };
}

// --- compact wire format ---------------------------------------------------
// [songId, transpose, capo, notation(0|1), view(0|1), flow(string[]|0), note, role]

type WireEntry = [string, number, number, 0 | 1, 0 | 1, string[] | 0, string?, string?];
type Wire = { n: string; d: string; e: WireEntry[]; i?: string };

function toWire(set: Setlist): Wire {
  return {
    n: set.name,
    d: set.date,
    i: set.shareId, // undefined -> omitted by JSON.stringify
    e: set.entries.map((x) => [
      x.songId,
      x.transpose,
      x.capo,
      x.notation === "roman" ? 1 : 0,
      x.view === "lyrics" ? 1 : 0,
      x.flow ?? 0,
      x.note || "",
      x.role || "",
    ]),
  };
}

function fromWire(w: Wire): Setlist {
  return {
    name: w.n ?? "",
    date: w.d ?? "",
    shareId: typeof w.i === "string" && w.i ? w.i : undefined,
    entries: (w.e ?? []).map((e) => ({
      songId: e[0],
      transpose: e[1] ?? 0,
      capo: e[2] ?? 0,
      notation: e[3] === 1 ? "roman" : "names",
      view: e[4] === 1 ? "lyrics" : "chart",
      flow: Array.isArray(e[5]) ? e[5] : null,
      note: typeof e[6] === "string" ? e[6] : "",
      role: typeof e[7] === "string" ? e[7] : "",
    })),
  };
}

export function encodeSetlist(set: Setlist): string {
  return compressToEncodedURIComponent(JSON.stringify(toWire(set)));
}

export function decodeSetlist(s: string): Setlist | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    return fromWire(JSON.parse(json) as Wire);
  } catch {
    return null;
  }
}

export function shareUrl(set: Setlist): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#s=${encodeSetlist(set)}`;
}

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
    /* ignore */
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

export function saveNamedSet(set: Setlist): SavedSetlist[] {
  const list = loadSavedSets();
  const name = set.name.trim() || "Untitled set";
  const at = Date.now();
  const i = list.findIndex((s) => s.name.toLowerCase() === name.toLowerCase());
  const entry: SavedSetlist = { ...set, name, id: i >= 0 ? list[i].id : String(at), savedAt: at };
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

/** Export all saved sets as a portable code (paste on another device). */
export function exportSavedCode(): string {
  return compressToEncodedURIComponent(JSON.stringify(loadSavedSets()));
}

/** Import saved sets from a code, merging by id. Returns the new list. */
export function importSavedCode(code: string): SavedSetlist[] {
  const json = decompressFromEncodedURIComponent(code.trim());
  if (!json) throw new Error("Invalid code");
  const incoming = JSON.parse(json) as SavedSetlist[];
  if (!Array.isArray(incoming)) throw new Error("Invalid code");
  const byId = new Map(loadSavedSets().map((s) => [s.id, s]));
  for (const s of incoming) if (s && s.id) byId.set(s.id, s);
  const merged = [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
  writeSaved(merged);
  return merged;
}
