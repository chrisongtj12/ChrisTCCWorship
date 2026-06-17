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
          className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <nav className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={
                "shrink-0 rounded-lg sm:flex sm:items-center sm:justify-between " +
                (s.id === selectedId
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800")
              }
            >
              <button onClick={() => setSelectedId(s.id)} className="flex-1 px-3 py-2 text-left text-sm">
                <div className="font-medium">{s.title}</div>
                <div className={"text-xs " + (s.id === selectedId ? "text-sky-100" : "text-slate-400")}>
                  {s.key ?? "—"}
                  {s.choRaw ? "" : " · lyrics only"}
                  {s.lyrics ? "" : " · chart only"}
                </div>
              </button>
              <button
                onClick={() => onAddToSet(s.id)}
                title="Add to setlist"
                className={
                  "mr-2 hidden h-6 w-6 rounded text-sm leading-none sm:flex sm:items-center sm:justify-center " +
                  (s.id === selectedId ? "bg-sky-500 hover:bg-sky-400" : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600")
                }
              >
                +
              </button>
            </div>
          ))}
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
