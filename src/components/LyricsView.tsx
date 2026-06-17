import type { Lyrics } from "../lib/types.ts";

export function LyricsView({ lyrics }: { lyrics: Lyrics }) {
  // Lyrics are FIXED — always rendered in full, natural order.
  return (
    <div className="text-[17px] sm:text-lg leading-relaxed">
      {lyrics.sections.map((sec, i) => (
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
