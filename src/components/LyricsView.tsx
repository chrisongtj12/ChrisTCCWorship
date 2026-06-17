import { useMemo } from "react";
import type { Lyrics, LyricSection } from "../lib/types.ts";

type Props = {
  lyrics: Lyrics;
  /** ordered section labels; null = natural order */
  flow?: string[] | null;
};

export function LyricsView({ lyrics, flow }: Props) {
  const ordered: LyricSection[] = useMemo(() => {
    if (!flow || flow.length === 0) return lyrics.sections;
    const out: LyricSection[] = [];
    for (const label of flow) {
      const match = lyrics.sections.find((s) => s.label === label);
      if (match) out.push(match);
    }
    return out;
  }, [lyrics, flow]);

  return (
    <div className="text-[17px] sm:text-lg leading-relaxed">
      {ordered.map((sec, i) => (
        <div key={i} className="mb-5">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {sec.label}
          </div>
          {sec.lines.map((ln, j) =>
            ln === "" ? (
              <div key={j} className="h-2" />
            ) : (
              <div key={j} className="text-slate-800 dark:text-slate-100">
                {ln}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
