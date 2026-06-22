// Client for the live "follow-the-leader" session store (/api/live). The leader
// publishes a small state blob (current song / key / view / scroll); band
// devices poll it and follow. Degrades silently when the endpoint or KV is
// missing (local dev) — reads return null and writes are no-ops.
import { getPin } from "./prefs.ts";

export type LiveState = {
  v: number; // schema version
  idx: number; // current song index (in the playable order)
  songId: string; // sanity-match the song
  view: "chart" | "lyrics"; // which view the leader is showing
  scrollPct: number; // 0..1 scroll fraction
  leader: string; // display name
  t: number; // leader's clock (ms) — used to detect staleness/echo
  // NOTE: key/capo/notation are intentionally NOT synced — they're per-player
  // (capo differs by instrument). The leader commits the official key via the
  // shared key store (Save), not the live channel.
};

export async function fetchLive(id: string): Promise<LiveState | null> {
  try {
    const r = await fetch(`/api/live?id=${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.state && typeof j.state === "object" ? (j.state as LiveState) : null;
  } catch {
    return null;
  }
}

// Returns true only on a real publish. A wrong PIN (403) or a deploy without KV
// (200 + { ok:false, disabled:true }) both count as failure so the caller can
// tell the leader it didn't take.
export async function publishLive(id: string, state: LiveState): Promise<boolean> {
  try {
    const r = await fetch("/api/live", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, state, pin: getPin() }),
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    return j.ok !== false;
  } catch {
    return false;
  }
}

export async function stopLive(id: string): Promise<boolean> {
  try {
    const r = await fetch("/api/live", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stop: true, pin: getPin() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
