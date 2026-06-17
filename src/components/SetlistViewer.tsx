import { useEffect, useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist, SetEntry } from "../lib/setlist.ts";
import { encodeSetlist } from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { availableSections } from "../lib/song.ts";
import { SongView } from "./SongView.tsx";
import { ChartView } from "./ChartView.tsx";
import { LyricsView } from "./LyricsView.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

type Props = {
  set: Setlist;
  songs: Song[];
};

function orderLabels(entry: SetEntry, song: Song): string[] {
  return entry.flow && entry.flow.length ? entry.flow : availableSections(song);
}

export function SetlistViewer({ set, songs }: Props) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  // Editable working copy so cue notes can be tweaked live (persisted to the URL).
  const [liveSet, setLiveSet] = useState<Setlist>(set);
  const entries = liveSet.entries
    .map((e, origIdx) => ({ e, origIdx }))
    .filter(({ e }) => byId.has(e.songId));

  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("tcc.scrollspeed") || "40", 10);
    return Number.isNaN(v) ? 40 : v;
  });

  const n = entries.length;
  const go = (next: number) => setIdx(() => Math.min(n - 1, Math.max(0, next)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setIdx((p) => Math.min(n - 1, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setAuto(false);
  }, [idx]);

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      window.scrollBy(0, speed * dt);
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1) {
        setAuto(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, speed]);

  const changeSpeed = (d: number) => {
    const v = Math.min(200, Math.max(10, speed + d));
    setSpeed(v);
    try {
      localStorage.setItem("tcc.scrollspeed", String(v));
    } catch {
      /* ignore */
    }
  };

  // Edit a cue note for the entry at original index; persist into the URL hash.
  const setNote = (origIdx: number, note: string) => {
    const next: Setlist = {
      ...liveSet,
      entries: liveSet.entries.map((e, j) => (j === origIdx ? { ...e, note } : e)),
    };
    setLiveSet(next);
    try {
      history.replaceState(null, "", "#s=" + encodeSetlist(next));
    } catch {
      /* ignore */
    }
  };

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

  if (n === 0) {
    return (
      <Shell title={liveSet.name || "Setlist"} date={liveSet.date} onPrint={printSet}>
        <p className="text-slate-400">
          This shared setlist references songs that aren't in the library on this site.
        </p>
      </Shell>
    );
  }

  const i = Math.min(idx, n - 1);
  const { e: entry, origIdx } = entries[i];
  const song = byId.get(entry.songId)!;
  const order = orderLabels(entry, song);

  return (
    <Shell title={liveSet.name || "Setlist"} date={liveSet.date} onPrint={printSet}>
      <div className="no-print">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {entries.map(({ e }, j) => {
            const s = byId.get(e.songId)!;
            return (
              <button
                key={j}
                onClick={() => go(j)}
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

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={() => setAuto((a) => !a)}
            className={
              "rounded-lg px-3 py-1.5 font-medium " +
              (auto ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
            }
          >
            {auto ? "⏸ Stop scroll" : "▶ Auto-scroll"}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button onClick={() => changeSpeed(-10)} className="px-2.5 py-1 text-slate-500 hover:text-sky-600">
              –
            </button>
            <span className="min-w-[4.5rem] text-center text-xs text-slate-400">speed {speed}</span>
            <button onClick={() => changeSpeed(10)} className="px-2.5 py-1 text-slate-500 hover:text-sky-600">
              +
            </button>
          </div>
          <span className="text-xs text-slate-400">← / → (or a foot pedal) change songs</span>
        </div>

        <div className="sm:flex sm:gap-4">
          {order.length > 0 && (
            <aside className="mb-3 sm:mb-0 sm:w-44 sm:shrink-0">
              <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:sticky sm:top-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Song order</div>
                <ol className="space-y-1">
                  {order.map((l, k) => (
                    <li key={k} className="flex gap-2 text-sm">
                      <span className="w-4 text-right text-slate-400">{k + 1}</span>
                      <span className="text-slate-700 dark:text-slate-200">{l}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          )}

          <main className="min-w-0 flex-1 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
            <SongView
              key={i + ":" + entry.songId}
              song={song}
              initialTranspose={entry.transpose}
              initialCapo={entry.capo}
              initialNotation={entry.notation}
              initialView={entry.view}
              note={entry.note}
              onNoteChange={(v) => setNote(origIdx, v)}
            />
          </main>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            disabled={i === 0}
            onClick={() => go(i - 1)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-400">
            {i + 1} of {n}
          </span>
          <button
            disabled={i === n - 1}
            onClick={() => go(i + 1)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-40 dark:border-slate-700"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="print-only">
        {entries.map(({ e }, j) => {
          const s = byId.get(e.songId)!;
          const sounding = s.key ? transposeKey(s.key, e.transpose) : null;
          const ord = orderLabels(e, s);
          return (
            <div key={j} className="print-song mb-6">
              <h2 className="text-xl font-bold">
                {j + 1}. {s.title} {sounding ? <span className="text-base font-normal">— {sounding}</span> : null}
              </h2>
              {ord.length > 0 && (
                <div className="mt-1 text-sm">
                  <span className="font-semibold">Order: </span>
                  {ord.join(" · ")}
                </div>
              )}
              {e.note && (
                <div className="mt-1 whitespace-pre-line text-sm">
                  <span className="font-semibold">Cue: </span>
                  {e.note}
                </div>
              )}
              <div className="mt-2">
                {e.view === "chart" && s.choRaw ? (
                  <ChartView choRaw={s.choRaw} originalKey={s.key} transpose={e.transpose} capo={e.capo} notation={e.notation} />
                ) : s.lyrics ? (
                  <LyricsView lyrics={s.lyrics} />
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
