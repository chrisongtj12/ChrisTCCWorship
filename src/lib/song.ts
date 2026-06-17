import { parseChordPro, groupChartSections } from "./chordpro.ts";
import type { Song } from "./types.ts";

/**
 * Ordered, de-duplicated list of section labels available for a song,
 * combining the ChordPro chart's {comment} sections and the TCC lyric
 * sheet's [Section] markers. This is the natural play order and the menu
 * of sections the user can arrange into a custom flow.
 */
export function availableSections(song: Song): string[] {
  const labels: string[] = [];
  const add = (l: string | null) => {
    if (l && !labels.includes(l)) labels.push(l);
  };
  if (song.choRaw) {
    for (const s of groupChartSections(parseChordPro(song.choRaw))) add(s.label);
  }
  if (song.lyrics) {
    for (const s of song.lyrics.sections) add(s.label);
  }
  return labels;
}
