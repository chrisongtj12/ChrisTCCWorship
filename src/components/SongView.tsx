import { useEffect, useRef, useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Notation, View } from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { readSongKey, writeSongKey } from "../lib/prefs.ts";
import { ChartView } from "./ChartView.tsx";
import { LyricsView } from "./LyricsView.tsx";
import { Segmented, Btn, CapoSelect } from "./ui.tsx";

type Props = {
  song: Song;
  initialTranspose?: number;
  initialCapo?: number;
  initialNotation?: Notation;
  initialView?: View;
  note?: string;
  onNoteChange?: (v: string) => void;
  // Fired only on an explicit Chart/Lyrics toggle (not auto-correction), so a
  // parent can keep the chosen view "sticky" across songs.
  onViewChange?: (v: View) => void;
  // Fired whenever the live transpose changes (mount + each +/–), so a parent
  // can broadcast the leader's current key for band sync.
  onTransposeChange?: (t: number) => void;
  // Library: persist the transposed key as this song's GENERAL default (per device).
  allowSaveKey?: boolean;
  // Called after a save: in a setlist it persists the key to that set's entry;
  // in the library it lets the parent refresh (e.g. the key-tag badge).
  onSaveKey?: (transpose: number) => void;
  // Editing keys is gated by the leader PIN — Save buttons show only when unlocked.
  unlocked?: boolean;
};

const SCALE_KEY = "tcc.fontscale";
function clampScale(v: number): number {
  return Math.min(2.2, Math.max(0.6, Math.round(v * 10) / 10));
}

function beatsFromTime(time: string | null): number {
  if (!time) return 4;
  const n = parseInt(time.split("/")[0], 10);
  return Number.isNaN(n) || n < 1 ? 4 : n;
}

export function SongView({
  song,
  initialTranspose = 0,
  initialCapo = 0,
  initialNotation = "names",
  initialView = "chart",
  note,
  onNoteChange,
  onViewChange,
  onTransposeChange,
  allowSaveKey = false,
  onSaveKey,
  unlocked = false,
}: Props) {
  const hasChart = !!song.choRaw;
  const hasLyrics = !!song.lyrics;
  const hasMerged = !!song.merged;

  // "combined" = the AI-merged chart (chords over TCC wording); only offered when present.
  const [view, setView] = useState<View | "combined">(hasChart ? initialView : "lyrics");
  // In the library, seed from any saved per-song key override; in a setlist use
  // the entry's transpose. `savedKey` tracks what's persisted (for the Save button).
  const [transpose, setTranspose] = useState(() =>
    allowSaveKey ? readSongKey(song.id) : initialTranspose
  );
  const [savedKey, setSavedKey] = useState(() =>
    allowSaveKey ? readSongKey(song.id) : initialTranspose
  );
  const canSaveKey = allowSaveKey || !!onSaveKey;

  const saveKey = () => {
    if (allowSaveKey) writeSongKey(song.id, transpose); // global default
    onSaveKey?.(transpose); // setlist: persist to the entry; library: refresh tag
    setSavedKey(transpose);
  };
  const [capo, setCapo] = useState(initialCapo);
  const [notation, setNotation] = useState<Notation>(initialNotation);
  const [scale, setScale] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(SCALE_KEY) || "1");
    return Number.isNaN(v) ? 1 : clampScale(v);
  });

  // Metronome / tempo
  const bpmKey = `tcc.bpm.${song.id}`;
  const [bpm, setBpm] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(bpmKey) || "", 10);
    if (!Number.isNaN(saved)) return saved;
    const t = song.tempo ? parseInt(song.tempo, 10) : NaN;
    return Number.isNaN(t) ? 120 : t;
  });
  const [metro, setMetro] = useState(false);
  const [tick, setTick] = useState(0);
  const [beat, setBeat] = useState(0);
  const beats = beatsFromTime(song.time);

  // Free-text while editing; clamp/commit only on blur or Enter so a leading
  // digit below the 30 minimum (e.g. the "1" of "120") isn't clamped away.
  const [bpmInput, setBpmInput] = useState<string>(() => String(bpm));

  const changeBpm = (v: number) => {
    const c = Math.min(300, Math.max(30, v));
    setBpm(c);
    setBpmInput(String(c));
    try {
      localStorage.setItem(bpmKey, String(c));
    } catch {
      /* ignore */
    }
  };

  const commitBpm = () => {
    const n = parseInt(bpmInput, 10);
    if (Number.isNaN(n)) setBpmInput(String(bpm)); // revert blank/garbage
    else changeBpm(n);
  };

  const beatRef = useRef(0);
  useEffect(() => {
    if (!metro) return;
    beatRef.current = 0;
    setBeat(0);
    setTick((x) => x + 1);
    const id = setInterval(() => {
      beatRef.current = (beatRef.current + 1) % beats;
      setBeat(beatRef.current);
      setTick((x) => x + 1);
    }, 60000 / bpm);
    return () => clearInterval(id);
  }, [metro, bpm, beats]);

  const changeScale = (delta: number) => {
    const c = clampScale(scale + delta);
    setScale(c);
    try {
      localStorage.setItem(SCALE_KEY, String(c));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (view === "chart" && !hasChart) setView("lyrics");
    if (view === "lyrics" && !hasLyrics) setView("chart");
    if (view === "combined" && !hasMerged) setView(hasChart ? "chart" : "lyrics");
  }, [view, hasChart, hasLyrics, hasMerged]);

  // Report the current key up (mount + every change) for live band sync.
  useEffect(() => {
    onTransposeChange?.(transpose);
  }, [transpose, onTransposeChange]);

  const soundingKey = song.key ? transposeKey(song.key, transpose) : null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="fg-songtitle text-xl font-bold">{song.title}</h2>
        {song.artist && <span className="text-sm text-slate-400">{song.artist}</span>}
      </div>
      {song.ccli && <div className="mb-2 text-xs text-slate-400">CCLI #{song.ccli}</div>}

      {/* Tempo + metronome bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
        {song.time && (
          <span className="text-base font-bold tabular-nums" title="Time signature">
            {song.time}
          </span>
        )}
        <label className="flex items-center gap-1 text-sm">
          <span className="text-slate-500">BPM</span>
          <input
            type="number"
            value={bpmInput}
            min={30}
            max={300}
            inputMode="numeric"
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold tabular-nums dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <button
          onClick={() => setMetro((m) => !m)}
          className={
            "flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium " +
            (metro ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300")
          }
          title="Metronome light"
        >
          <span
            key={tick}
            className={
              "inline-block h-3.5 w-3.5 rounded-full " +
              (metro ? "metro-flash " : "") +
              (!metro
                ? "bg-slate-400"
                : beat === 0
                ? "bg-amber-300"
                : "bg-sky-300")
            }
          />
          Metronome
        </button>
        {metro && <span className="text-xs text-slate-400 tabular-nums">beat {beat + 1}/{beats}</span>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v as View | "combined");
            if (v !== "combined") onViewChange?.(v as View);
          }}
          options={[
            { value: "chart", label: "Chart", disabled: !hasChart },
            { value: "lyrics", label: "Lyrics", disabled: !hasLyrics },
            ...(hasMerged ? [{ value: "combined", label: "Both" }] : []),
          ]}
        />

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <Btn onClick={() => changeScale(-0.1)} aria="smaller text">
            A−
          </Btn>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-slate-400">{Math.round(scale * 100)}%</span>
          <Btn onClick={() => changeScale(0.1)} aria="larger text">
            A+
          </Btn>
        </div>

        {view !== "lyrics" && (
          <>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Btn onClick={() => setTranspose((t) => t - 1)} aria="transpose down">
                –
              </Btn>
              <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">{soundingKey ?? "key?"}</span>
              <Btn onClick={() => setTranspose((t) => t + 1)} aria="transpose up">
                +
              </Btn>
            </div>
            <CapoSelect value={capo} onChange={setCapo} />
            <Segmented
              value={notation}
              onChange={(v) => setNotation(v as Notation)}
              options={[
                { value: "names", label: "Names" },
                { value: "roman", label: "Roman" },
              ]}
            />
            {canSaveKey && unlocked && transpose !== savedKey && (
              <button
                onClick={saveKey}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                title={allowSaveKey ? "Lock this in as the song's general key" : "Save this key to the set"}
              >
                {allowSaveKey ? "Save key" : "Save to set"} {soundingKey ? `(${soundingKey})` : ""}
              </button>
            )}
            {(transpose !== 0 || capo !== 0) && (
              <button
                onClick={() => {
                  setTranspose(0);
                  setCapo(0);
                }}
                className="text-xs text-slate-400 underline hover:text-slate-600"
              >
                reset
              </button>
            )}
          </>
        )}
      </div>

      {/* Cue notes (editable when onNoteChange is provided) */}
      {onNoteChange && (
        <textarea
          value={note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          placeholder="Cue notes"
          className="mb-4 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      )}

      {view !== "lyrics" && capo > 0 && (
        <div className="mb-3 text-xs text-slate-400">
          Capo {capo} — shapes in {song.key ? transposeKey(song.key, transpose - capo) : "?"}, sounding in {soundingKey}.
        </div>
      )}

      <div className="overflow-x-auto" style={{ zoom: scale } as React.CSSProperties}>
        {view === "combined" && hasMerged ? (
          <ChartView choRaw={song.merged!} originalKey={song.key} transpose={transpose} capo={capo} notation={notation} />
        ) : view === "chart" && hasChart ? (
          <ChartView choRaw={song.choRaw!} originalKey={song.key} transpose={transpose} capo={capo} notation={notation} />
        ) : hasLyrics ? (
          <LyricsView lyrics={song.lyrics!} />
        ) : (
          <p className="text-slate-400">No {view} available.</p>
        )}
      </div>
    </div>
  );
}
