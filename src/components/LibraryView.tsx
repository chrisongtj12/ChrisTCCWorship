import { useMemo, useState } from "react";
import type { Song } from "../lib/types.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { readSongKey } from "../lib/prefs.ts";
import { SongView } from "./SongView.tsx";

type Props = {
  songs: Song[];
  onAddToSet: (songId: string) => void;
  unlocked?: boolean;
};

// Effective key = original key shifted by the saved global default (per device).
function effectiveKey(s: Song): string {
  if (!s.key) return "–";
  return transposeKey(s.key, readSongKey(s.id));
}

export function LibraryView({ songs, onAddToSet, unlocked = false }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(songs[0]?.id ?? null);
  const [query, setQuery] = useState("");
  // Most of the library is lyrics-only; sets are usually built from charted songs.
  const [chartedOnly, setChartedOnly] = useState(false);
  // Bumped when a song's key is saved, so the key tags re-read the new defaults.
  const [, bumpKeys] = useState(0);

  // Catalogue numbers are fixed per song (position in the full library).
  const numById = useMemo(() => {
    const m = new Map<string, string>();
    songs.forEach((s, i) => m.set(s.id, String(i + 1).padStart(2, "0")));
    return m;
  }, [songs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = chartedOnly ? songs.filter((s) => s.choRaw) : songs;
    if (q) {
      list = list.filter(
        (s) => s.title.toLowerCase().includes(q) || (s.artist ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [songs, query, chartedOnly]);

  const song = songs.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[260px_1fr]">
      {/* Sticky on desktop so the catalogue keeps its own scroll beside the chart. */}
      <div className="sm:sticky sm:top-4 sm:self-start">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs or artists…"
          className="fgsearch mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="mb-2 flex gap-1.5 text-xs">
          <button
            onClick={() => setChartedOnly(false)}
            className={
              "rounded-md px-2.5 py-1 font-medium " +
              (!chartedOnly
                ? "bg-sky-600 text-white"
                : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
            }
          >
            All ({songs.length})
          </button>
          <button
            onClick={() => setChartedOnly(true)}
            className={
              "rounded-md px-2.5 py-1 font-medium " +
              (chartedOnly
                ? "bg-sky-600 text-white"
                : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800")
            }
          >
            With charts ({songs.filter((s) => s.choRaw).length})
          </button>
        </div>
        <nav className="fgnav flex max-h-[52vh] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 sm:max-h-[calc(100vh-11rem)] sm:rounded-none sm:border-0 sm:border-y sm:border-slate-200 sm:dark:border-slate-700">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No songs match “{query.trim()}”.
            </p>
          )}
          {filtered.map((s, i) => {
            const num = numById.get(s.id)!;
            const selected = s.id === selectedId;
            return (
              <div
                key={s.id}
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                className={
                  "fg-rise fgrow flex items-center justify-between rounded-lg " +
                  (selected ? "selected " : "") +
                  (selected
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800")
                }
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm"
                >
                  <span className="fg-num fg-only w-7 shrink-0">
                    No.
                    <br />
                    {num}
                  </span>
                  <span className="min-w-0 flex-1">
                    <div className="fg-title font-medium">{s.title}</div>
                    {s.artist && <div className="fg-attr fg-only truncate text-xs">{s.artist}</div>}
                    <div className={"dark-only text-xs " + (selected ? "text-sky-100" : "text-slate-400")}>
                      {s.choRaw ? effectiveKey(s) : "lyrics"}
                      {s.lyrics ? "" : " · chart only"}
                    </div>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2 pr-2">
                  {s.choRaw ? (
                    <span className="fg-keytag fg-only">{effectiveKey(s)}</span>
                  ) : (
                    <span className="fg-attr fg-only text-[10px] uppercase tracking-wider opacity-60">lyrics</span>
                  )}
                  <button
                    onClick={() => onAddToSet(s.id)}
                    title="Add to setlist"
                    className={
                      "flex h-7 w-7 items-center justify-center rounded text-base leading-none " +
                      (selected ? "bg-sky-500 text-white hover:bg-sky-400" : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600")
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <main className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
        {song ? (
          <>
            <SongView
              key={song.id}
              song={song}
              allowSaveKey
              unlocked={unlocked}
              onSaveKey={() => bumpKeys((v) => v + 1)}
            />
            <button
              onClick={() => onAddToSet(song.id)}
              className="mt-5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              + Add to setlist
            </button>
          </>
        ) : (
          <p className="text-slate-400">No song selected.</p>
        )}
      </main>
    </div>
  );
}
