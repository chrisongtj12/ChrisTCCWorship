// Song key preferences, stored as a transpose offset (semitones) from a song's
// original key. Two layers — global default per song, and per-set key per
// (service, song) — with precedence: per-set → global default → original.
//
// Source of truth is the shared server store (/api/keys on Vercel KV), so every
// visitor sees the leader's keys with no share link. Reads come from an in-memory
// cache loaded once at startup (loadKeys), mirrored to localStorage for offline.
// Writes update the cache immediately and best-effort sync to the server; the
// server only accepts them with the correct leader PIN (the band stays read-only).

type KeyDoc = { song: Record<string, number>; set: Record<string, Record<string, number>> };

let cache: KeyDoc = { song: {}, set: {} };

const PIN_KEY = "tcc.leaderpin";
const CACHE_KEY = "tcc.keys.cache";

export function getPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || "";
  } catch {
    return "";
  }
}
export function setPin(pin: string): void {
  try {
    if (pin) localStorage.setItem(PIN_KEY, pin);
    else localStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
}
export function isUnlocked(): boolean {
  return !!getPin();
}

function localInt(key: string): number | null {
  try {
    const v = parseInt(localStorage.getItem(key) || "", 10);
    return Number.isNaN(v) ? null : v;
  } catch {
    return null;
  }
}
function localSet(key: string, v: number): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

// Fetch the shared keys once at startup. Falls back to the last cached copy
// offline; never throws.
export async function loadKeys(): Promise<void> {
  try {
    const r = await fetch("/api/keys");
    if (r.ok) {
      const j = await r.json();
      cache = { song: j.song || {}, set: j.set || {} };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {
        /* ignore */
      }
      return;
    }
  } catch {
    /* offline → use the cached copy below */
  }
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (c && c.song) cache = c;
  } catch {
    /* ignore */
  }
}

export function readSongKey(id: string): number {
  if (id in cache.song) return cache.song[id];
  return localInt(`tcc.songkey.${id}`) ?? 0; // legacy per-device fallback
}
export function readServiceKey(shareId: string, songId: string): number | null {
  const s = cache.set[shareId];
  if (s && songId in s) return s[songId];
  return localInt(`tcc.setkey.${shareId}.${songId}`); // legacy per-device fallback
}

function putKey(body: Record<string, unknown>): void {
  // fire-and-forget; server validates the PIN and ignores band writes
  fetch("/api/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, pin: getPin() }),
  }).catch(() => {
    /* offline; local cache already updated */
  });
}

export function writeSongKey(id: string, transpose: number): void {
  cache.song[id] = transpose;
  localSet(`tcc.songkey.${id}`, transpose);
  putKey({ scope: "song", songId: id, transpose });
}
export function writeServiceKey(shareId: string, songId: string, transpose: number): void {
  (cache.set[shareId] = cache.set[shareId] || {})[songId] = transpose;
  localSet(`tcc.setkey.${shareId}.${songId}`, transpose);
  putKey({ scope: "set", shareId, songId, transpose });
}
