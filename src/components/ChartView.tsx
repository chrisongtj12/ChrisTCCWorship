import { useMemo } from "react";
import {
  parseChordPro,
  groupChartSections,
  chordToName,
  chordToRoman,
  transposeKey,
  type SongLine,
  type ChartSection,
} from "../lib/chordpro.ts";

type Props = {
  choRaw: string;
  originalKey: string | null;
  transpose: number;
  capo: number;
  notation: "names" | "roman";
  /** ordered section labels; null = natural order */
  flow?: string[] | null;
};

export function ChartView({ choRaw, originalKey, transpose, capo, notation, flow }: Props) {
  const sections = useMemo(() => groupChartSections(parseChordPro(choRaw)), [choRaw]);

  // Chord NAMES are printed for the shapes you finger: sounding key (+transpose)
  // shifted down by the capo fret.
  const displayOffset = transpose - capo;
  const shapeKey = originalKey ? transposeKey(originalKey, displayOffset) : null;

  // Determine the section render order.
  const ordered: ChartSection[] = useMemo(() => {
    if (!flow || flow.length === 0) return sections;
    const out: ChartSection[] = [];
    const intro = sections.find((s) => s.label === null);
    if (intro && intro.lines.some((l) => l.type !== "blank")) out.push(intro);
    for (const label of flow) {
      const match = sections.find((s) => s.label === label);
      if (match) out.push(match);
    }
    return out;
  }, [sections, flow]);

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
                  <span className="whitespace-pre text-slate-800 dark:text-slate-100">{seg.text}</span>
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
      {ordered.map((sec, si) => (
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
