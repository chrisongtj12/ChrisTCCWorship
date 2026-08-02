// Upcoming-services roster. The committed ROSTER below is the seed; the live
// copy is stored in the shared KV store (/api/roster) so the band sees the
// leader's services (song order + keys) with no share link. Editing is done in
// the Setlist builder and saved back to the server (PIN-gated).
import type { Setlist, Notation, View } from "../lib/setlist.ts";
import { newEntry } from "../lib/setlist.ts";
import { readSongKey, readServiceKey, getPin } from "../lib/prefs.ts";

export type RosterEntry = {
  role: string; // slot label, e.g. "Opening Song" — shown on the service card
  cue?: string; // free-text performance cue, separate from the slot label
  songId: string;
  transpose?: number;
  capo?: number;
  notation?: Notation;
  view?: View;
  flow?: string[] | null; // per-song section-order reminder
};
export type Service = {
  date: string; // ISO, e.g. "2026-06-21"
  display: string; // "Sunday 21 June"
  theme: string | null;
  leader: string;
  entries: RosterEntry[]; // in service order
};

export const serviceShareId = (date: string) => "svc" + date.replace(/-/g, "");

export const ROSTER: Service[] = [
  {
    date: "2026-06-21",
    display: "Sunday 21 June",
    theme: "New Song – How Great",
    leader: "Chris",
    entries: [
      { role: "Opening Song", songId: "you-are-unchanging" },
      { role: "Song 2", songId: "how-great-psalm-145" },
      { role: "Kids' Song", songId: "mighty-mighty-savior" },
      { role: "Pre-Sermon", songId: "his-mercy-is-more" },
      { role: "Response", songId: "a-mighty-fortress-is-our-god" },
    ],
  },
  {
    date: "2026-06-28",
    display: "Sunday 28 June",
    theme: null,
    leader: "Chris",
    entries: [
      { role: "Opening Song", songId: "how-great-psalm-145" },
      { role: "Song 2", songId: "his-mercy-is-more" },
      { role: "Kids' Song", songId: "mighty-mighty-savior" },
      { role: "Pre-Sermon", songId: "he-will-keep-you-psalm-121" },
      { role: "Response", songId: "let-your-kingdom-come" },
    ],
  },
  {
    date: "2026-07-05",
    display: "Sunday 5 July",
    theme: null,
    leader: "Combined",
    entries: [
      { role: "Opening Song", songId: "rejoice" },
      { role: "Song 2", songId: "from-everlasting-psalm-90" },
      { role: "Kids' Song", songId: "god-speaks" },
      { role: "Pre-Sermon", songId: "he-will-keep-you-psalm-121" },
      { role: "Response", songId: "yet-not-i-but-through-christ-in-me" },
    ],
  },
  {
    date: "2026-07-12",
    display: "Sunday 12 July",
    theme: null,
    leader: "Combined",
    entries: [
      { role: "Opening Song", songId: "how-great-psalm-145" },
      { role: "Song 2", songId: "behold-the-lamb" },
      { role: "Kids' Song", songId: "god-speaks" },
      { role: "Pre-Sermon", songId: "from-everlasting-psalm-90" },
      { role: "Response", songId: "rejoice" },
    ],
  },
  {
    // Keys + roles per Service Planning 2026 / Song Choosing.xlsx (worship team).
    date: "2026-08-02",
    display: "Sunday 2 August",
    theme: "Limited Atonement",
    leader: "Chris",
    entries: [
      // My Hope: Emu arr. (CCLI 7189243), chart now written in D (team key) → transpose 0.
      { role: "Opening Song", songId: "my-hope-is-built-on-nothing-less", transpose: 0 },
      // Alas: no team key (G). Playing note from planning sheet:
      { role: "Song 2", songId: "alas-and-did-my-savior-bleed", cue: "Play standard — skip the elaborate 3:15 transition & minor-key last chorus; straight into repeat chorus" },
      // When I Survey: team key E or F; chart is F, keeping F.
      { role: "Pre-Sermon", songId: "when-i-survey-the-wondrous-cross" },
      // All Sufficient Merit: team key G/Ab/A (chart written C → transpose −5 = G).
      { role: "Response", songId: "all-sufficient-merit", transpose: -5 },
      { role: "Kids' Song", songId: "jesus-when-you-died" },
    ],
  },
  {
    date: "2026-08-09",
    display: "Sunday 9 August",
    theme: "Irresistible Grace",
    leader: "Chris",
    entries: [
      { role: "Opening Song", songId: "all-sufficient-merit", transpose: -5 }, // G
      { role: "Song 2", songId: "my-hope-is-built-on-nothing-less", transpose: 0 }, // D (Emu arr., chart in D)
      { role: "Pre-Sermon", songId: "amazing-grace-hymn" }, // no team key (G)
      { role: "Response", songId: "o-great-god" }, // no team key (C)
      { role: "Kids' Song", songId: "jesus-when-you-died" },
    ],
  },
];

// Build a shareable/playable Setlist from a service. Per-song key precedence:
// play-view tweak (per-service key store) → the service's saved key → global default.
export function serviceToSetlist(s: Service): Setlist {
  const shareId = serviceShareId(s.date);
  return {
    name: s.display + (s.theme ? ` — ${s.theme}` : ""),
    date: s.date,
    shareId,
    entries: s.entries.map((e) => ({
      ...newEntry(e.songId),
      role: e.role, // slot label (card label)
      note: e.cue ?? "", // performance cue (kept separate from the label)
      transpose:
        readServiceKey(shareId, e.songId) ??
        (typeof e.transpose === "number" ? e.transpose : readSongKey(e.songId)),
      capo: e.capo ?? 0,
      notation: e.notation ?? "names",
      view: e.view ?? "chart",
      flow: e.flow ?? null,
    })),
  };
}

// Convert an edited setlist (from the builder) back to a service, keeping the
// service's display/theme/leader. Order + per-song keys come from the setlist.
export function setlistToService(set: Setlist, base: Service): Service {
  return {
    ...base,
    date: set.date || base.date,
    entries: set.entries.map((e) => ({
      role: e.role || "",
      cue: e.note || "",
      songId: e.songId,
      transpose: e.transpose,
      capo: e.capo,
      notation: e.notation,
      view: e.view,
      flow: e.flow,
    })),
  };
}

export function serviceForShareId(roster: Service[], shareId: string | undefined): Service | null {
  if (!shareId) return null;
  return roster.find((s) => serviceShareId(s.date) === shareId) ?? null;
}

// ---- Shared roster store (server, with committed seed) ---------------------

let cache: Service[] = ROSTER;

export function getRoster(): Service[] {
  return cache;
}

export async function loadRoster(): Promise<Service[]> {
  let serverServices: Service[] = [];
  try {
    const r = await fetch("/api/roster");
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.services)) serverServices = j.services;
    }
  } catch {
    /* offline → seed only */
  }
  // The committed seed is the baseline; server-saved services override by date
  // (and any extra server services are appended). Merging — not replacing —
  // keeps unsaved seed services from disappearing once one service is saved.
  cache = mergeRoster(ROSTER, serverServices);
  return cache;
}

function mergeRoster(seed: Service[], server: Service[]): Service[] {
  const merged = seed.slice();
  for (const svc of server) {
    const i = merged.findIndex((s) => s.date === svc.date);
    if (i >= 0) merged[i] = svc;
    else merged.push(svc);
  }
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

// Upsert a service (by date) locally and on the server (PIN-gated). Returns the
// new roster list; sync is best-effort.
export function saveService(updated: Service): Service[] {
  cache = cache.some((s) => s.date === updated.date)
    ? cache.map((s) => (s.date === updated.date ? updated : s))
    : [...cache, updated].sort((a, b) => a.date.localeCompare(b.date));
  fetch("/api/roster", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service: updated, pin: getPin() }),
  }).catch(() => {
    /* offline; local cache already updated */
  });
  return cache;
}
