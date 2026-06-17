import { useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist } from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { SongView } from "./SongView.tsx";
import { ChartView } from "./ChartView.tsx";
import { LyricsView } from "./LyricsView.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

type Props = {
  set: Setlist;
  songs: Song[];
};

export function SetlistViewer({ set, songs }: Props) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const entries = set.entries.filter((e) => byId.has(e.songId));
  const [idx, setIdx] = useState(0);

  // Print light (ink-friendly) regardless of the active theme.
  const printSet = () => {
    const el = document.documentElement;
    const had = { dark: el.classList.contains("dark"), stage: el.classList.contains("stage") };
    el.classList.remove("dark", "stage");
    window.print();
    setTimeout(() => {
      if (had.dark) el.classList.add("dark");
      if (had.stage) el.classList.add("stage");
    }, 800);
  };

  if (entries.length === 0) {
    return (
      <Shell title={set.name || "Setlist"} date={set.date} onPrint={printSet}>
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
    <Shell title={set.name || "Setlist"} date={set.date} onPrint={printSet}>
      {/* Interactive performance view (hidden when printing) */}
      <div className="no-print">
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
      </div>

      {/* Print / PDF: every song in order, ink-friendly */}
      <div className="print-only">
        {entries.map((e, j) => {
          const s = byId.get(e.songId)!;
          const sounding = s.key ? transposeKey(s.key, e.transpose) : null;
          return (
            <div key={j} className="print-song mb-6">
              <h2 className="text-xl font-bold">
                {j + 1}. {s.title} {sounding ? <span className="text-base font-normal">— {sounding}</span> : null}
              </h2>
              <div className="mt-2">
                {e.view === "chart" && s.choRaw ? (
                  <ChartView
                    choRaw={s.choRaw}
                    originalKey={s.key}
                    transpose={e.transpose}
                    capo={e.capo}
                    notation={e.notation}
                    flow={e.flow}
                  />
                ) : s.lyrics ? (
                  <LyricsView lyrics={s.lyrics} flow={e.flow} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({
  title,
  date,
  onPrint,
  children,
}: {
  title: string;
  date: string;
  onPrint: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight">
            {title}
            {date && <span className="ml-2 text-sm font-normal text-slate-400">{date}</span>}
          </h1>
          <div className="no-print flex items-center gap-3">
            <ThemeToggle />
            <button onClick={onPrint} className="text-xs text-slate-400 underline hover:text-sky-600">
              Print / PDF
            </button>
            <a href="#" className="text-xs text-slate-400 underline hover:text-sky-600">
              Open editor
            </a>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
