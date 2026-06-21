import { useEffect, useMemo, useState } from "react";
import type { Song, SongsData } from "./lib/types.ts";
import {
  type Setlist,
  newEntry,
  emptySetlist,
  ensureShareId,
  loadDraft,
  saveDraft,
  setlistFromHash,
} from "./lib/setlist.ts";
import { LibraryView } from "./components/LibraryView.tsx";
import { SetlistBuilder } from "./components/SetlistBuilder.tsx";
import { UpcomingServices } from "./components/UpcomingServices.tsx";
import { SetlistViewer } from "./components/SetlistViewer.tsx";
import { ThemeToggle } from "./components/ThemeToggle.tsx";
import { loadKeys, setPin, isUnlocked } from "./lib/prefs.ts";
import {
  type Service,
  getRoster,
  loadRoster,
  saveService,
  setlistToService,
  serviceForShareId,
} from "./data/roster.ts";

type Tab = "library" | "setlist";

export function App() {
  const [data, setData] = useState<SongsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("library");
  const [set, setSet] = useState<Setlist>(() => loadDraft() ?? emptySetlist());
  const [shared, setShared] = useState<Setlist | null>(() => setlistFromHash());
  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());
  const [roster, setRoster] = useState<Service[]>(() => getRoster());

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}songs.json`).then((r) =>
        r.ok ? (r.json() as Promise<SongsData>) : Promise.reject(new Error(`HTTP ${r.status}`))
      ),
      loadKeys(), // shared keys, applied before the UI renders
      loadRoster().then(setRoster), // shared services
    ])
      .then(([d]) => setData(d))
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

  // Give the set a stable shareId as soon as it has songs, so share links and
  // ▶ Play carry it and map to the same shared cue-notes locker.
  useEffect(() => {
    if (set.entries.length && !set.shareId) setSet((s) => ensureShareId(s));
  }, [set.entries.length, set.shareId]);

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

  if (shared) return <SetlistViewer set={shared} songs={songs} unlocked={unlocked} />;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ButterflyMark className="fg-only" />
            <div className="mr-1">
              <h1 className="text-xl font-bold leading-none tracking-tight">
                <span className="fg-only">TCC Worship</span>
                <span className="dark-only">TCC Setlist</span>
              </h1>
              <div className="fg-strap fg-only mt-1">A field guide to the setlist</div>
            </div>
            <nav className="fgseg inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              <TabBtn active={tab === "library"} onClick={() => setTab("library")}>
                Library
              </TabBtn>
              <TabBtn active={tab === "setlist"} onClick={() => setTab("setlist")}>
                Setlist{set.entries.length ? ` (${set.entries.length})` : ""}
              </TabBtn>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <EditLock unlocked={unlocked} onChange={setUnlocked} />
            <ThemeToggle />
            <span className="hidden text-xs text-slate-400 sm:inline">
              {songs.length} <span className="fg-only">specimens</span>
              <span className="dark-only">songs</span>
            </span>
          </div>
        </header>

        {tab === "library" ? (
          <LibraryView songs={songs} onAddToSet={addToSet} unlocked={unlocked} />
        ) : (
          <>
            <UpcomingServices services={roster} songs={songs} onEdit={setSet} />
            <SetlistBuilder
              songs={songs}
              set={set}
              onChange={setSet}
              service={serviceForShareId(roster, set.shareId)}
              canEditService={unlocked}
              onSaveService={() => {
                const base = serviceForShareId(roster, set.shareId);
                if (base) setRoster(saveService(setlistToService(set, base)));
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ButterflyMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 26 26" aria-hidden="true">
      <g fill="#2f6f5e">
        <ellipse cx="9" cy="9" rx="6" ry="7.2" transform="rotate(-18 9 9)" />
        <ellipse cx="17" cy="9" rx="6" ry="7.2" transform="rotate(18 17 9)" />
      </g>
      <g fill="#a4382b">
        <ellipse cx="9.6" cy="17" rx="4.6" ry="5.2" transform="rotate(20 9.6 17)" />
        <ellipse cx="16.4" cy="17" rx="4.6" ry="5.2" transform="rotate(-20 16.4 17)" />
      </g>
      <line x1="13" y1="5.5" x2="13" y2="20.5" stroke="#2c271d" strokeWidth="1.2" />
    </svg>
  );
}

// Leader-PIN toggle: unlocks key editing so the Save buttons appear and sync to
// everyone. Locked = read-only (no Save buttons; the band can transpose to view
// but not change shared keys).
function EditLock({ unlocked, onChange }: { unlocked: boolean; onChange: (v: boolean) => void }) {
  const toggle = () => {
    if (unlocked) {
      setPin("");
      onChange(false);
    } else {
      const p = window.prompt("Enter the leader PIN to edit keys for everyone:");
      if (p && p.trim()) {
        setPin(p.trim());
        onChange(true);
      }
    }
  };
  return (
    <button
      onClick={toggle}
      title={unlocked ? "Editing keys for everyone — click to lock" : "Unlock key editing (leader PIN)"}
      className={
        "rounded-md px-2.5 py-1 text-xs font-medium " +
        (unlocked
          ? "bg-emerald-600 text-white hover:bg-emerald-500"
          : "border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800")
      }
    >
      {unlocked ? "Editing ✓" : "Edit keys"}
    </button>
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
