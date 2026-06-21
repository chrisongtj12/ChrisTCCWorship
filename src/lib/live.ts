// Client for the live "follow-the-leader" session store (/api/live). The leader
// publishes a small state blob (current song / key / view / scroll); band
// devices poll it and follow. Degrades silently when the endpoint or KV is
// missing (local dev) — reads return null and writes are no-ops.
import { getPin } from "./prefs.ts";

export type LiveState = {
  v: number; // schema version
  idx: number; // current song index (in the playable order)
  songId: string; // sanity-match the song
  transpose: number; // current live key offset
  view: "chart" | "lyrics";
  scrollPct: number; // 0..1 scroll fraction
  leader: string; // display name
  t: number; // leader's clock (ms) — used to detect staleness/echo
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

export async function publishLive(id: string, state: LiveState): Promise<boolean> {
  try {
    const r = await fetch("/api/live", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, state, pin: getPin() }),
    });
    return r.ok;
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
