import { useEffect, useRef, useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist, SetEntry, View, Notation } from "../lib/setlist.ts";
import { encodeSetlist } from "../lib/setlist.ts";
import { fetchNotes, saveNote } from "../lib/notes.ts";
import { fetchLive, publishLive, stopLive, type LiveState } from "../lib/live.ts";
import { getPin, setPin } from "../lib/prefs.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { availableSections } from "../lib/song.ts";
import { SongView } from "./SongView.tsx";
import { ChartView } from "./ChartView.tsx";
import { LyricsView } from "./LyricsView.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Segmented, Btn, CapoSelect } from "./ui.tsx";

type Props = {
  set: Setlist;
  songs: Song[];
  unlocked?: boolean;
};

function orderLabels(entry: SetEntry, song: Song): string[] {
  return entry.flow && entry.flow.length ? entry.flow : availableSections(song);
}

export function SetlistViewer({ set, songs, unlocked = false }: Props) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  // Editable working copy so cue notes can be tweaked live (persisted to the URL).
  const [liveSet, setLiveSet] = useState<Setlist>(set);
  const entries = liveSet.entries
    .map((e, origIdx) => ({ e, origIdx }))
    .filter(({ e }) => byId.has(e.songId));

  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  // Shared cue-notes (E1): true once the server confirms the store is live.
  const [notesSync, setNotesSync] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Sticky Chart/Lyrics mode: seeded from the first song, then follows your
  // explicit toggles so it carries across songs as you nav/swipe.
  const [viewMode, setViewMode] = useState<View>(() => entries[0]?.e.view ?? "chart");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [speed, setSpeed] = useState<number>(() => {
    const v = parseInt(localStorage.getItem("tcc.scrollspeed") || "40", 10);
    return Number.isNaN(v) ? 40 : v;
  });

  const n = entries.length;
  const i = n ? Math.min(idx, n - 1) : 0;
  const cur = entries[i];
  const curSongId = cur?.e.songId ?? "";

  // --- Live "follow-the-leader" band sync ----------------------------------
  const liveId = liveSet.shareId;
  const [leading, setLeading] = useState(false); // I am broadcasting (leader)
  const [live, setLive] = useState<LiveState | null>(null); // latest session state seen
  const [following, setFollowing] = useState(true); // auto-follow when a session is live
  const applyingScroll = useRef(false);
  const scrollPct = useRef(0);

  // Local-only key/capo/notation (per player — capo differs by instrument, so
  // these are never synced). Key + capo reset per song; notation is a sticky
  // personal preference that carries across songs.
  const [tpose, setTpose] = useState(() => cur?.e.transpose ?? 0);
  const [capo, setCapo] = useState(() => cur?.e.capo ?? 0);
  const [notation, setNotation] = useState<Notation>(() => cur?.e.notation ?? "names");

  const go = (next: number) => {
    if (live && !leading && following) setFollowing(false); // manual nav → browse
    setIdx(() => Math.min(n - 1, Math.max(0, next)));
  };

  // On open, pull the shared notes for this set and overlay them (server wins).
  useEffect(() => {
    const id = set.shareId;
    if (!id) return;
    let cancelled = false;
    fetchNotes(id).then(({ notes, enabled }) => {
      if (cancelled) return;
      setNotesSync(enabled);
      if (enabled && notes && Object.keys(notes).length) {
        setLiveSet((prev) => ({
          ...prev,
          entries: prev.entries.map((e) =>
            typeof notes[e.songId] === "string" ? { ...e, note: notes[e.songId] } : e
          ),
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [set.shareId]);

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

  // New song → reset local key/capo to that song's saved defaults (notation is
  // sticky, so it is intentionally left alone).
  useEffect(() => {
    if (cur) {
      setTpose(cur.e.transpose);
      setCapo(cur.e.capo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

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

  // Keep the screen awake while leading (released on leaving the view / tab
  // hidden; re-acquired when visible again). No-op where unsupported.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let done = false;
    const request = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {
        /* ignore (unsupported / not visible) */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible" && !done) request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVis);
      try {
        lock?.release();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Leader: broadcast current song/key/view (+ heartbeat to keep the session
  // alive). Re-publishes whenever any of those change.
  useEffect(() => {
    if (!leading || !liveId) return;
    const push = () =>
      publishLive(liveId, {
        v: 1,
        idx: i,
        songId: curSongId,
        view: viewMode,
        scrollPct: scrollPct.current,
        leader: "Leader",
        t: Date.now(),
      });
    push();
    const hb = setInterval(push, 3000);
    return () => clearInterval(hb);
  }, [leading, liveId, i, curSongId, viewMode]);

  // Leader: publish scroll position (throttled) so followers track the page.
  useEffect(() => {
    if (!leading || !liveId) return;
    let last = 0;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollPct.current = max > 0 ? window.scrollY / max : 0;
      const now = Date.now();
      if (now - last < 350) return;
      last = now;
      publishLive(liveId, {
        v: 1,
        idx: i,
        songId: curSongId,
        view: viewMode,
        scrollPct: scrollPct.current,
        leader: "Leader",
        t: Date.now(),
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [leading, liveId, i, curSongId, viewMode]);

  // Follower: poll the live session (skipped while leading). A session is
  // considered live only if its heartbeat is recent.
  useEffect(() => {
    if (!liveId || leading) {
      setLive(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const s = await fetchLive(liveId);
      if (cancelled) return;
      setLive(s && Date.now() - s.t < 20000 ? s : null);
    };
    poll();
    const id = setInterval(poll, 1600);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [liveId, leading]);

  // Follower: when following, mirror the leader's song/view/key/scroll.
  useEffect(() => {
    if (!live || leading || !following) return;
    if (live.idx !== i) setIdx(live.idx);
    if (live.view === "chart" || live.view === "lyrics") setViewMode(live.view);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.max(0, live.scrollPct) * max;
    if (Math.abs(window.scrollY - target) > 24) {
      applyingScroll.current = true;
      window.scrollTo(0, target);
      setTimeout(() => {
        applyingScroll.current = false;
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, leading, following]);

  // Follower: a genuine scroll gesture (wheel/touch) pauses following so you
  // can read ahead; "Re-sync" resumes. Programmatic scrolls don't fire these.
  useEffect(() => {
    if (!live || leading || !following) return;
    const pause = () => setFollowing(false);
    window.addEventListener("wheel", pause, { passive: true });
    window.addEventListener("touchmove", pause, { passive: true });
    return () => {
      window.removeEventListener("wheel", pause);
      window.removeEventListener("touchmove", pause);
    };
  }, [live, leading, following]);

  const toggleLead = async () => {
    if (!liveId) return;
    if (leading) {
      setLeading(false);
      stopLive(liveId);
      return;
    }
    // Allow leading straight from the Play view: prompt for the PIN if this
    // device hasn't unlocked yet, then verify it with one real publish.
    if (!getPin()) {
      const entered = (window.prompt("Enter the leader PIN to lead the band:") || "").trim();
      if (!entered) return;
      setPin(entered);
    }
    const ok = await publishLive(liveId, {
      v: 1,
      idx: i,
      songId: curSongId,
      view: viewMode,
      scrollPct: scrollPct.current,
      leader: "Leader",
      t: Date.now(),
    });
    if (!ok) {
      setPin("");
      window.alert("Couldn't start leading — the PIN was rejected, or live sync isn't enabled on this deployment.");
      return;
    }
    setFollowing(false);
    setLive(null);
    setLeading(true);
  };


  // Swipe left → next song, right → prev. Only a mostly-horizontal drag past a
  // threshold counts, so vertical reading-scroll and text selection are safe.
  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && el.closest("input, textarea, select")) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? idx + 1 : idx - 1);
    }
  };

  const changeSpeed = (d: number) => {
    const v = Math.min(200, Math.max(10, speed + d));
    setSpeed(v);
    try {
      localStorage.setItem("tcc.scrollspeed", String(v));
    } catch {
      /* ignore */
    }
  };

  // Edit a cue note for the entry at original index. Persist into the URL hash
  // (local fallback + keeps the copyable link current) and, if this set has a
  // shareId, save to the shared store (debounced) so everyone on the link sees it.
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
    const id = liveSet.shareId;
    const songId = liveSet.entries[origIdx]?.songId;
    if (id && songId) {
      clearTimeout(saveTimers.current[songId]);
      saveTimers.current[songId] = setTimeout(() => saveNote(id, songId, note), 600);
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

  const { e: entry, origIdx } = cur!;
  const song = byId.get(entry.songId)!;
  const order = orderLabels(entry, song);
  const barKey = song.key ? transposeKey(song.key, tpose) : null;

  return (
    <Shell title={liveSet.name || "Setlist"} date={liveSet.date} onPrint={printSet}>
      <div className="no-print">
        {/* Sticky single-line control bar: live status + LOCAL key/capo/notation
            (per player, never synced). Scrolls sideways if it can't all fit. */}
        <div className="sticky top-0 z-30 -mx-4 mb-3 border-b border-slate-200 bg-slate-50/90 px-4 py-1.5 backdrop-blur dark:border-slate-700 dark:bg-slate-950/90">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto text-sm [&>*]:shrink-0">
            {leading ? (
              <span className="flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white metro-flash" />
                Controlling
              </span>
            ) : live ? (
              // The status chip IS the follow toggle: Controlled (synced) ⇄ Paused.
              // Tapping Paused resumes following; tapping Controlled takes control.
              <button
                onClick={() => setFollowing((f) => !f)}
                title={following ? "Synced to the leader — tap to take control" : "Paused — tap to resume following the leader"}
                className={
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white " +
                  (following ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500")
                }
              >
                <span className={"inline-block h-1.5 w-1.5 rounded-full bg-white " + (following ? "metro-flash" : "")} />
                {following ? "Controlled" : "⏸ Paused"}
              </button>
            ) : null}

            <Segmented
              size="sm"
              value={notation}
              onChange={(v) => setNotation(v as Notation)}
              options={[
                { value: "names", label: "Names" },
                { value: "roman", label: "Roman" },
              ]}
            />

            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Btn onClick={() => setTpose((t) => t - 1)} aria="key down">
                –
              </Btn>
              <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">{barKey ?? "key?"}</span>
              <Btn onClick={() => setTpose((t) => t + 1)} aria="key up">
                +
              </Btn>
            </div>

            <CapoSelect value={capo} onChange={setCapo} />

            {(tpose !== 0 || capo !== 0) && (
              <button
                onClick={() => {
                  setTpose(0);
                  setCapo(0);
                }}
                className="text-xs text-slate-400 underline hover:text-slate-600"
              >
                reset
              </button>
            )}
          </div>
        </div>

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
          {liveId && (
            <button
              onClick={toggleLead}
              title={leading ? "Stop broadcasting — band stops following" : "Broadcast your song/key/scroll so the band's phones follow you (leader PIN)"}
              className={
                "rounded-lg px-3 py-1.5 font-medium " +
                (leading
                  ? "bg-rose-600 text-white hover:bg-rose-500"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
              }
            >
              {leading ? "● Leading — stop" : "📡 Lead live"}
            </button>
          )}
          <span className="text-xs text-slate-400">swipe · ← / → · foot pedal — change songs</span>
          {leading && <span className="text-xs text-rose-600 dark:text-rose-400">band phones are following you</span>}
          {notesSync && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              ✎ cue notes save &amp; sync for everyone on this link
            </span>
          )}
        </div>

        <div className="sm:flex sm:gap-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
              hideKeyControls
              fitDefault
              transpose={tpose}
              capo={capo}
              notation={notation}
              initialView={viewMode}
              note={entry.note}
              onNoteChange={(v) => setNote(origIdx, v)}
              onViewChange={setViewMode}
              unlocked={unlocked}
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
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-base font-bold leading-tight tracking-tight sm:text-lg">
              {title}
              {date && (
                <span className="mt-0.5 block text-xs font-normal text-slate-400 sm:ml-2 sm:mt-0 sm:inline">
                  {date}
                </span>
              )}
            </h1>
            <div className="no-print shrink-0">
              <ThemeToggle />
            </div>
          </div>
          <div className="no-print mt-2 flex items-center gap-4 text-xs">
            <a href="#" className="whitespace-nowrap text-slate-400 underline hover:text-sky-600">
              Open editor
            </a>
            <button onClick={onPrint} className="whitespace-nowrap text-slate-400 underline hover:text-sky-600">
              Print / PDF
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
