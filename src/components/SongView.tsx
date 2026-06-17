import { useEffect, useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Notation, View } from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { ChartView } from "./ChartView.tsx";
import { LyricsView } from "./LyricsView.tsx";
import { Segmented, Btn, CapoSelect } from "./ui.tsx";

type Props = {
  song: Song;
  initialTranspose?: number;
  initialCapo?: number;
  initialNotation?: Notation;
  initialView?: View;
};

/**
 * Renders a single song (full, fixed chart/lyrics) with its own controls.
 * Seeded from initial* props. Parents pass key={...} to reset on song change.
 */
export function SongView({
  song,
  initialTranspose = 0,
  initialCapo = 0,
  initialNotation = "names",
  initialView = "chart",
}: Props) {
  const hasChart = !!song.choRaw;
  const hasLyrics = !!song.lyrics;

  const [view, setView] = useState<View>(hasChart ? initialView : "lyrics");
  const [transpose, setTranspose] = useState(initialTranspose);
  const [capo, setCapo] = useState(initialCapo);
  const [notation, setNotation] = useState<Notation>(initialNotation);

  useEffect(() => {
    if (view === "chart" && !hasChart) setView("lyrics");
    if (view === "lyrics" && !hasLyrics) setView("chart");
  }, [view, hasChart, hasLyrics]);

  const soundingKey = song.key ? transposeKey(song.key, transpose) : null;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-bold">{song.title}</h2>
        {song.artist && <span className="text-sm text-slate-400">{song.artist}</span>}
      </div>
      {song.ccli && <div className="mb-3 text-xs text-slate-400">CCLI #{song.ccli}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: "chart", label: "Chart", disabled: !hasChart },
            { value: "lyrics", label: "Lyrics", disabled: !hasLyrics },
          ]}
        />

        {view === "chart" && hasChart && (
          <>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Btn onClick={() => setTranspose((t) => t - 1)} aria="transpose down">
                –
              </Btn>
              <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
                {soundingKey ?? "key?"}
              </span>
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

      {view === "chart" && capo > 0 && hasChart && (
        <div className="mb-3 text-xs text-slate-400">
          Capo {capo} — shapes in {song.key ? transposeKey(song.key, transpose - capo) : "?"}, sounding in{" "}
          {soundingKey}.
        </div>
      )}

      <div className="overflow-x-auto">
        {view === "chart" && hasChart ? (
          <ChartView
            choRaw={song.choRaw!}
            originalKey={song.key}
            transpose={transpose}
            capo={capo}
            notation={notation}
          />
        ) : hasLyrics ? (
          <LyricsView lyrics={song.lyrics!} />
        ) : (
          <p className="text-slate-400">No {view} available.</p>
        )}
      </div>
    </div>
  );
}
