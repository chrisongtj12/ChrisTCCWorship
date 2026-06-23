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
  columns?: number; // 1 (default) or 2 — multi-column flow for landscape
};

export function ChartView({ choRaw, originalKey, transpose, capo, notation, columns = 1 }: Props) {
  // The song chart is FIXED — always rendered in full, natural order.
  const sections = useMemo(() => groupChartSections(parseChordPro(choRaw)), [choRaw]);

  const displayOffset = transpose - capo;
  const shapeKey = originalKey ? transposeKey(originalKey, displayOffset) : null;

  function renderLine(line: SongLine, idx: number) {
    switch (line.type) {
      case "lyric":
        return (
          <div key={idx} className="flex flex-wrap items-end leading-tight mb-[0.4em] font-mono">
            {line.segments.map((seg, i) => {
              const label = seg.chord
                ? notation === "roman"
                  ? chordToRoman(seg.chord, displayOffset, shapeKey)
                  : chordToName(seg.chord, displayOffset, shapeKey)
                : "";
              return (
                <span key={i} className="inline-flex flex-col">
                  <span className="h-[1.35em] text-sky-600 dark:text-sky-400 font-semibold whitespace-pre">
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
        return <div key={idx} className="h-[0.8em]" />;
      case "text":
        return (
          <div key={idx} className="text-[0.8em] text-slate-400 dark:text-slate-500 font-mono">
            {line.text}
          </div>
        );
      default:
        return null;
    }
  }

  const renderSection = (sec: (typeof sections)[number], si: number) => (
    <div key={si}>
      {sec.label && (
        <div className="mt-[1.3em] mb-[0.5em] text-[0.8em] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          {sec.label}
        </div>
      )}
      {sec.lines.map((line, li) => renderLine(line, li))}
    </div>
  );

  // Two columns: split sections across two side-by-side columns, balanced by
  // ESTIMATED RENDERED HEIGHT (lyric rows are tallest, then labels), and pick the
  // break point that makes the two columns most even. Done explicitly (not CSS
  // multicol) so it survives the zoom-based Fit scaling and lets Fit size both
  // columns to the screen width.
  if (columns === 2 && sections.length > 1) {
    const lineH = (l: SongLine) => (l.type === "lyric" ? 46 : l.type === "blank" ? 12 : 20);
    const secH = (s: (typeof sections)[number]) =>
      (s.label ? 44 : 0) + s.lines.reduce((a, l) => a + lineH(l), 0);
    const heights = sections.map(secH);
    const total = heights.reduce((a, b) => a + b, 0);
    let prefix = 0;
    let split = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < sections.length; i++) {
      prefix += heights[i - 1]; // height of sections [0 .. i-1]
      const diff = Math.abs(2 * prefix - total); // |left − right|
      if (diff < bestDiff) {
        bestDiff = diff;
        split = i;
      }
    }
    return (
      <div className="flex items-start gap-[2em]">
        <div className="min-w-0">{sections.slice(0, split).map(renderSection)}</div>
        <div className="min-w-0">{sections.slice(split).map(renderSection)}</div>
      </div>
    );
  }

  return <div>{sections.map(renderSection)}</div>;
}
