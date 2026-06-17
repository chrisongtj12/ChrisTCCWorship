import { useEffect, useMemo, useState } from "react";
import type { Song, SongsData } from "./lib/types.ts";
import {
  type Setlist,
  newEntry,
  emptySetlist,
  loadDraft,
  saveDraft,
  setlistFromHash,
} from "./lib/setlist.ts";
import { LibraryView } from "./components/LibraryView.tsx";
import { SetlistBuilder } from "./components/SetlistBuilder.tsx";
import { SetlistViewer } from "./components/SetlistViewer.tsx";

type Tab = "library" | "setlist";

export function App() {
  const [data, setData] = useState<SongsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("library");
  const [set, setSet] = useState<Setlist>(() => loadDraft() ?? emptySetlist());
  const [shared, setShared] = useState<Setlist | null>(() => setlistFromHash());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}songs.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: SongsData) => setData(d))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setShared(setlistFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    saveDraft(set);
  }, [set]);

  const songs: Song[] = data?.songs ?? [];

  const addToSet = (songId: string) => {
    // Stay on the Library tab so several songs can be added in a row;
    // the "Setlist (n)" counter reflects the additions.
    setSet((s) => ({ ...s, entries: [...s.entries, newEntry(songId)] }));
  };

  if (error)
    return (
      <Centered>
        Couldn't load songs.json — {error}. Run <code>npm run build:songs</code>.
      </Centered>
    );
  if (!data) return <Centered>Loading…</Centered>;

  if (shared) return <SetlistViewer set={shared} songs={songs} />;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">TCC Setlist</h1>
            <nav className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <TabBtn active={tab === "library"} onClick={() => setTab("library")}>
                Library
              </TabBtn>
              <TabBtn active={tab === "setlist"} onClick={() => setTab("setlist")}>
                Setlist{set.entries.length ? ` (${set.entries.length})` : ""}
              </TabBtn>
            </nav>
          </div>
          <span className="text-xs text-slate-400">{songs.length} songs</span>
        </header>

        {tab === "library" ? (
          <LibraryView songs={songs} onAddToSet={addToSet} />
        ) : (
          <SetlistBuilder songs={songs} set={set} onChange={setSet} />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-3 py-1 text-sm transition " +
        (active ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
      }
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6 text-center text-slate-500">
      <div>{children}</div>
    </div>
  );
}
