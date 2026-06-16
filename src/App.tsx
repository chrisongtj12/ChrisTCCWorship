import { useEffect, useMemo, useState } from "react";
import type { Song, SongsData } from "./lib/types.ts";
import { transposeKey } from "./lib/chordpro.ts";
import { ChartView } from "./components/ChartView.tsx";
import { LyricsView } from "./components/LyricsView.tsx";

type View = "chart" | "lyrics";
type Notation = "names" | "roman";

export function App() {
  const [data, setData] = useState<SongsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [view, setView] = useState<View>("chart");
  const [transpose, setTranspose] = useState(0);
  const [capo, setCapo] = useState(0);
  const [notation, setNotation] = useState<Notation>("names");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}songs.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SongsData) => {
        setData(d);
        setSelectedId(d.songs[0]?.id ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const song: Song | null = useMemo(
    () => data?.songs.find((s) => s.id === selectedId) ?? null,
    [data, selectedId]
  );

  // Reset per-song controls when the song changes.
  useEffect(() => {
    setTranspose(0);
    setCapo(0);
    if (song && !song.choRaw && song.lyrics) setView("lyrics");
    else setView("chart");
  }, [selectedId]);

  if (error)
    return <Centered>Couldn't load songs.json — {error}. Run <code>npm run build:songs</code>.</Centered>;
  if (!data) return <Centered>Loading…</Centered>;

  const soundingKey = song?.key ? transposeKey(song.key, transpose) : null;
  const hasChart = !!song?.choRaw;
  const hasLyrics = !!song?.lyrics;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">TCC Setlist</h1>
          <span className="text-xs text-slate-400">{data.songs.length} songs</span>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
          {/* Song list */}
          <nav className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
            {data.songs.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={
                  "shrink-0 rounded-lg px-3 py-2 text-left text-sm transition " +
                  (s.id === selectedId
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800")
                }
              >
                <div className="font-medium">{s.title}</div>
                <div className={"text-xs " + (s.id === selectedId ? "text-sky-100" : "text-slate-400")}>
                  {s.key ?? "—"}
                  {s.choRaw ? "" : " · lyrics only"}
                  {s.lyrics ? "" : " · chart only"}
                </div>
              </button>
            ))}
          </nav>

          {/* Viewer */}
          <main className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:p-6">
            {!song ? (
              <p className="text-slate-400">No song selected.</p>
            ) : (
              <>
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl font-bold">{song.title}</h2>
                  {song.artist && <span className="text-sm text-slate-400">{song.artist}</span>}
                </div>
                {song.ccli && <div className="mb-3 text-xs text-slate-400">CCLI #{song.ccli}</div>}

                {/* Controls */}
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

                      <label className="flex items-center gap-1 text-sm">
                        <span className="text-slate-400">Capo</span>
                        <select
                          value={capo}
                          onChange={(e) => setCapo(Number(e.target.value))}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                          {Array.from({ length: 8 }, (_, i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </label>

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
                    Capo {capo} — shapes shown in{" "}
                    {song.key ? transposeKey(song.key, transpose - capo) : "?"}, sounding in {soundingKey}.
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
                  ) : view === "lyrics" && hasLyrics ? (
                    <LyricsView lyrics={song.lyrics!} />
                  ) : (
                    <p className="text-slate-400">No {view} available for this song.</p>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6 text-center text-slate-500">
      <div>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, aria }: { children: React.ReactNode; onClick: () => void; aria: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="px-2.5 py-1 text-lg leading-none text-slate-600 hover:text-sky-600 dark:text-slate-300"
    >
      {children}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={
            "rounded-md px-3 py-1 text-sm transition " +
            (value === o.value
              ? "bg-sky-600 text-white"
              : o.disabled
              ? "text-slate-300 dark:text-slate-600"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
