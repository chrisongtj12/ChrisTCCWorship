import { useMemo } from "react";
import {
  parseChordPro,
  groupChartSections,
  chordToName,
  chordToRoman,
  transposeKey,
  type SongLine,
} from "../lib/chordpro.ts";

type Props = {
  choRaw: string;
  originalKey: string | null;
  transpose: number;
  capo: number;
  notation: "names" | "roman";
};

export function ChartView({ choRaw, originalKey, transpose, capo, notation }: Props) {
  // The song chart is FIXED — always rendered in full, natural order.
  const sections = useMemo(() => groupChartSections(parseChordPro(choRaw)), [choRaw]);

  const displayOffset = transpose - capo;
  const shapeKey = originalKey ? transposeKey(originalKey, displayOffset) : null;

  function renderLine(line: SongLine, idx: number) {
    switch (line.type) {
      case "lyric":
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
                  {/* zero-width space keeps an empty (trailing/adjacent-chord) cell full-height,
                    so items-end doesn't drop the chord down onto the lyric line */}
                <span className="whitespace-pre text-slate-800 dark:text-slate-100">
                  {seg.text === "" ? "\u200b" : seg.text}
                </span>
                </span>
              );
            })}
          </div>
        );
      case "blank":
        return <div key={idx} className="h-3" />;
      case "text":
        return (
          <div key={idx} className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            {line.text}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="text-[15px] sm:text-base">
      {sections.map((sec, si) => (
        <div key={si}>
          {sec.label && (
            <div className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {sec.label}
            </div>
          )}
          {sec.lines.map((line, li) => renderLine(line, li))}
        </div>
      ))}
    </div>
  );
}
