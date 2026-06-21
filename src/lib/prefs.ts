// Per-device key preferences (localStorage), stored as a transpose offset in
// semitones relative to a song's original key. Two layers:
//   - global default key per song      — set with "Save key" in the library
//   - per-set key per (set, song)       — set with "Save to set" in the Play view
// Precedence when opening a service: per-set key → global default → original.

const songKeyK = (id: string) => `tcc.songkey.${id}`;
const setKeyK = (shareId: string, songId: string) => `tcc.setkey.${shareId}.${songId}`;

function readInt(key: string): number | null {
  try {
    const v = parseInt(localStorage.getItem(key) || "", 10);
    return Number.isNaN(v) ? null : v;
  } catch {
    return null;
  }
}
function writeInt(key: string, v: number): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

export function readSongKey(id: string): number {
  return readInt(songKeyK(id)) ?? 0;
}
export function writeSongKey(id: string, transpose: number): void {
  writeInt(songKeyK(id), transpose);
}

export function readServiceKey(shareId: string, songId: string): number | null {
  return readInt(setKeyK(shareId, songId));
}
export function writeServiceKey(shareId: string, songId: string, transpose: number): void {
  writeInt(setKeyK(shareId, songId), transpose);
}
