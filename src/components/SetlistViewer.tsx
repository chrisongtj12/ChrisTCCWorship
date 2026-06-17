import { useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist } from "../lib/setlist.ts";
import { SongView } from "./SongView.tsx";

type Props = {
  set: Setlist;
  songs: Song[];
};

export function SetlistViewer({ set, songs }: Props) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const entries = set.entries.filter((e) => byId.has(e.songId));
  const [idx, setIdx] = useState(0);

  if (entries.length === 0) {
    return (
      <Shell title={set.name || "Setlist"} date={set.date}>
        <p className="text-slate-400">
          This shared setlist references songs that aren't in the library on this site.
        </p>
      </Shell>
    );
  }

  const i = Math.min(idx, entries.length - 1);
  const entry = entries[i];
  const song = byId.get(entry.songId)!;

  return (
    <Shell title={set.name || "Setlist"} date={set.date}>
      {/* Song nav */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {entries.map((e, j) => {
          const s = byId.get(e.songId)!;
          return (
            <button
              key={j}
              onClick={() => setIdx(j)}
              className={
                "shrink-0 rounded-lg px-3 py-1.5 text-sm transition " +
                (j === i
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800")
              }
            >
              <span className="mr-1 opacity-60">{j + 1}.</span>
              {s.title}
            </button>
          );
        })}
      </div>

      <main className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
        <SongView
          key={i + ":" + entry.songId}
          song={song}
          initialTranspose={entry.transpose}
          initialCapo={entry.capo}
          initialNotation={entry.notation}
          initialView={entry.view}
          flow={entry.flow}
        />
      </main>

      {/* Prev / Next */}
      <div className="mt-4 flex items-center justify-between">
        <button
          disabled={i === 0}
          onClick={() => setIdx(i - 1)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
        >
          ← Prev
        </button>
        <span className="text-xs text-slate-400">
          {i + 1} of {entries.length}
        </span>
        <button
          disabled={i === entries.length - 1}
          onClick={() => setIdx(i + 1)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
        >
          Next →
        </button>
      </div>
    </Shell>
  );
}

function Shell({ title, date, children }: { title: string; date: string; children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-baseline justify-between">
          <h1 className="text-lg font-bold tracking-tight">
            {title}
            {date && <span className="ml-2 text-sm font-normal text-slate-400">{date}</span>}
          </h1>
          <a href="#" className="text-xs text-slate-400 underline hover:text-sky-600">
            Open editor
          </a>
        </header>
        {children}
      </div>
    </div>
  );
}
