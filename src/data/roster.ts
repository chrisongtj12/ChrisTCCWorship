// Preloaded 9am service roster (committed). Each service maps a role to a song
// in the library. Song order is Opening → Song 2 → Kids' → Pre-Sermon →
// Response (Kids' song deliberately placed before the pre-sermon song).
import type { Setlist } from "../lib/setlist.ts";
import { newEntry } from "../lib/setlist.ts";
import { readSongKey, readServiceKey } from "../lib/prefs.ts";

export type RosterEntry = { role: string; songId: string };
export type Service = {
  date: string; // ISO, e.g. "2026-06-21"
  display: string; // "Sunday 21 June"
  theme: string | null; // e.g. "New Song – How Great"
  leader: string; // "Chris" / "Combined"
  entries: RosterEntry[]; // in service order
};

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
];

// Build a shareable/playable Setlist from a service. shareId is deterministic
// (per date) so shared cue notes stay consistent across devices.
export function serviceToSetlist(s: Service): Setlist {
  const shareId = "svc" + s.date.replace(/-/g, "");
  return {
    name: s.display + (s.theme ? ` — ${s.theme}` : ""),
    date: s.date,
    shareId,
    entries: s.entries.map((e) => ({
      ...newEntry(e.songId),
      note: e.role,
      // Per-set saved key → global default → original (0).
      transpose: readServiceKey(shareId, e.songId) ?? readSongKey(e.songId),
    })),
  };
}
