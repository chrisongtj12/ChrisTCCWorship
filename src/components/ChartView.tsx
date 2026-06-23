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

  const renderSection = (sec: (typeof sections)[number], si: number) => (
    <div key={si}>
      {sec.label && (
        <div className="mt-5 mb-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          {sec.label}
        </div>
      )}
      {sec.lines.map((line, li) => renderLine(line, li))}
    </div>
  );

  // Two columns: split sections across two side-by-side columns, balanced by
  // line count. Done explicitly (not CSS multicol) so it survives the zoom-based
  // Fit scaling and lets Fit size both columns to the screen width.
  if (columns === 2 && sections.length > 1) {
    const weight = (s: (typeof sections)[number]) => (s.label ? 1 : 0) + s.lines.length;
    const total = sections.reduce((a, s) => a + weight(s), 0);
    let acc = 0;
    let split = sections.length;
    for (let i = 0; i < sections.length; i++) {
      acc += weight(sections[i]);
      if (acc >= total / 2) {
        split = i + 1;
        break;
      }
    }
    return (
      <div className="flex items-start gap-8 text-[15px] sm:text-base">
        <div className="min-w-0">{sections.slice(0, split).map(renderSection)}</div>
        <div className="min-w-0">{sections.slice(split).map(renderSection)}</div>
      </div>
    );
  }

  return <div className="text-[15px] sm:text-base">{sections.map(renderSection)}</div>;
}
