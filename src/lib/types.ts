export type LyricSection = { label: string; lines: string[] };
export type Lyrics = { title: string | null; sections: LyricSection[] };

export type Song = {
  id: string;
  title: string;
  key: string | null;
  ccli: string | null;
  artist: string | null;
  choRaw: string | null;
  lyrics: Lyrics | null;
  sourceFiles: { cho: string | null; docx: string | null };
};

export type SongsData = { songs: Song[]; builtAt: string };
