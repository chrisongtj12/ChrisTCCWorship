import { useMemo, useState } from "react";
import type { Song } from "../lib/types.ts";
import { SongView } from "./SongView.tsx";

type Props = {
  songs: Song[];
  onAddToSet: (songId: string) => void;
};

export function LibraryView({ songs, onAddToSet }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(songs[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? songs.filter((s) => s.title.toLowerCase().includes(q)) : songs;
  }, [songs, query]);

  const song = songs.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[240px_1fr]">
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs…"
          className="fgsearch mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <nav className="fgnav flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {filtered.map((s) => {
            const num = String(songs.findIndex((x) => x.id === s.id) + 1).padStart(2, "0");
            const selected = s.id === selectedId;
            return (
              <div
                key={s.id}
                className={
                  "fgrow shrink-0 rounded-lg sm:flex sm:items-center sm:justify-between " +
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
                    <div className="fg-attr fg-only truncate text-xs">{s.artist ?? "—"}</div>
                    <div className={"dark-only text-xs " + (selected ? "text-sky-100" : "text-slate-400")}>
                      {s.key ?? "—"}
                      {s.choRaw ? "" : " · lyrics only"}
                      {s.lyrics ? "" : " · chart only"}
                    </div>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2 pr-2">
                  <span className="fg-keytag fg-only">{s.key ?? "–"}</span>
                  <button
                    onClick={() => onAddToSet(s.id)}
                    title="Add to setlist"
                    className={
                      "hidden h-6 w-6 rounded text-sm leading-none sm:flex sm:items-center sm:justify-center " +
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
            <SongView key={song.id} song={song} />
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
