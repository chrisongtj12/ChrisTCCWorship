import { useMemo } from "react";
import {
  parseChordPro,
  chordToName,
  chordToRoman,
  transposeKey,
  type SongLine,
} from "../lib/chordpro.ts";

type Props = {
  choRaw: string;
  originalKey: string | null;
  /** semitone transpose applied to sounding key */
  transpose: number;
  /** capo fret (0-11) */
  capo: number;
  /** "names" | "roman" */
  notation: "names" | "roman";
};

export function ChartView({ choRaw, originalKey, transpose, capo, notation }: Props) {
  const chart = useMemo(() => parseChordPro(choRaw), [choRaw]);

  // Chord NAMES are printed for the shapes you actually finger:
  // sounding key (+transpose) shifted down by the capo fret.
  const displayOffset = transpose - capo;
  const shapeKey = originalKey ? transposeKey(originalKey, displayOffset) : null;

  function renderChord(line: Extract<SongLine, { type: "lyric" }>, idx: number) {
    return (
      <div key={idx} className="flex flex-wrap items-end leading-tight mb-1.5 font-mono">
        {line.segments.map((seg, i) => {
          const label = seg.chord
            ? notation === "roman"
              ? chordToRoman(seg.chord, displayOffset, shapeKey)
              : chordToName(seg.chord, displayOffset, shapeKey)
            : "";
          return (
            <span key={i} className="inline-flex flex-col">
              <span className="h-5 text-sky-600 dark:text-sky-400 font-semibold whitespace-pre">
                {label ? label + " " : ""}
              </span>
              <span className="whitespace-pre text-slate-800 dark:text-slate-100">{seg.text}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="text-[15px] sm:text-base">
      {chart.lines.map((line, idx) => {
        switch (line.type) {
          case "section":
            return (
              <div
                key={idx}
                className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
              >
                {line.label}
              </div>
            );
          case "lyric":
            return renderChord(line, idx);
          case "blank":
            return <div key={idx} className="h-3" />;
          case "text":
            return (
              <div key={idx} className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                {line.text}
              </div>
            );
        }
      })}
    </div>
  );
}
