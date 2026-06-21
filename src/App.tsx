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
  const [tab, setTab] = useState<Tab>("setlist");
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
        <header className="fg-rule relative mb-5 overflow-hidden pb-4 pt-1">
          {/* Faint pinned specimen drifting off the top-right margin (Fable plate). */}
          <DecorButterfly className="fg-drift pointer-events-none absolute -right-16 -top-14 h-48 w-48 opacity-[0.14] dark:opacity-[0.1]" />

          {/* Masthead: big serif wordmark + theme toggle */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
                <span className="fg-only">TCC Worship</span>
                <span className="dark-only">TCC Setlist</span>
              </h1>
              <div className="fg-strap fg-only mt-2 leading-snug">A field guide to the setlist</div>
            </div>
            <div className="shrink-0">
              <ThemeToggle />
            </div>
          </div>

          {/* Tabs (full-width on phones) + Edit keys + count */}
          <div className="relative z-10 mt-3 flex items-center gap-2 sm:mt-4">
            <nav className="fgseg flex flex-1 gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700 sm:flex-none">
              <TabBtn
                active={tab === "library"}
                onClick={() => setTab("library")}
                className="flex-1 sm:flex-none sm:px-6"
              >
                Library
              </TabBtn>
              <TabBtn
                active={tab === "setlist"}
                onClick={() => setTab("setlist")}
                className="flex-1 sm:flex-none sm:px-6"
              >
                Setlist{set.entries.length ? ` (${set.entries.length})` : ""}
              </TabBtn>
            </nav>
            <EditLock unlocked={unlocked} onChange={setUnlocked} />
            <span className="ml-auto hidden text-xs text-slate-400 sm:inline">
              {songs.length} <span className="fg-only">specimens</span>
              <span className="dark-only">songs</span>
            </span>
          </div>
        </header>

        <div key={tab} className="fg-fade">
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
    </div>
  );
}

// Decorative antique-plate butterfly for the masthead margin (Field Guide /
// Fable motif). Symmetric specimen in the theme palette; rendered faint.
function DecorButterfly({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke="#2c271d" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M60 34 C 54 24 50 20 46 15" />
        <path d="M60 34 C 66 24 70 20 74 15" />
      </g>
      <circle cx="46" cy="14" r="2.2" fill="#2c271d" />
      <circle cx="74" cy="14" r="2.2" fill="#2c271d" />
      {/* forewings */}
      <g fill="#2f6f5e">
        <ellipse cx="40" cy="48" rx="24" ry="16" transform="rotate(-28 40 48)" />
        <ellipse cx="80" cy="48" rx="24" ry="16" transform="rotate(28 80 48)" />
      </g>
      {/* hindwings */}
      <g fill="#a4382b">
        <ellipse cx="46" cy="80" rx="17" ry="15" transform="rotate(22 46 80)" />
        <ellipse cx="74" cy="80" rx="17" ry="15" transform="rotate(-22 74 80)" />
      </g>
      <g fill="#9a6a1f">
        <circle cx="33" cy="44" r="3.4" />
        <circle cx="87" cy="44" r="3.4" />
      </g>
      <g fill="#f3ead4">
        <circle cx="44" cy="82" r="3" />
        <circle cx="76" cy="82" r="3" />
      </g>
      <ellipse cx="60" cy="60" rx="3.2" ry="27" fill="#2c271d" />
      <circle cx="60" cy="33" r="4.2" fill="#2c271d" />
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

function TabBtn({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm font-medium transition " +
        (active ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800") +
        " " +
        className
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
