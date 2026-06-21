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
        <header className="fg-rule relative mb-5 pb-4 pt-1">
          {/* Masthead: lithographic specimen emblem + big serif wordmark + theme toggle */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <LithoButterfly className="fg-flutter h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
                  <span className="fg-only">TCC Worship</span>
                  <span className="dark-only">TCC Setlist</span>
                </h1>
                <div className="fg-strap fg-only mt-2 leading-snug">A field guide to the setlist</div>
              </div>
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
// Lithographic-plate butterfly emblem for the masthead — a detailed, hand-drawn
// specimen (one half defined, mirrored) in the Field Guide palette with venation,
// patterned spots and an eyespot, echoing the Claude Fable plate.
function LithoButterfly({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="bfFore" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c8471" />
          <stop offset="1" stopColor="#235848" />
        </linearGradient>
        <linearGradient id="bfHind" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b94634" />
          <stop offset="1" stopColor="#8d2f22" />
        </linearGradient>
        <g id="bfHalf">
          {/* forewing */}
          <path
            d="M50 41 C 51 24 63 12 79 14 C 91 16 94 31 86 40 C 74 46 60 46 50 45 Z"
            fill="url(#bfFore)"
            stroke="#1f3f34"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* hindwing */}
          <path
            d="M50 52 C 51 66 60 88 75 84 C 88 80 89 65 79 58 C 69 53 58 52 50 52 Z"
            fill="url(#bfHind)"
            stroke="#5b231a"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* forewing apex patch */}
          <path d="M71 17 C 80 14 88 18 87 27 C 81 24 75 23 70 25 Z" fill="#1f3f34" opacity="0.6" />
          {/* forewing venation */}
          <g stroke="#1f3f34" strokeWidth="0.55" fill="none" opacity="0.5">
            <path d="M51 43 C 62 33 72 24 81 17" />
            <path d="M51 44 C 64 39 75 34 86 31" />
            <path d="M51 45 C 61 42 70 41 80 40" />
          </g>
          {/* forewing spots */}
          <circle cx="66" cy="30" r="2.6" fill="#ecd9ac" />
          <circle cx="75" cy="29" r="1.9" fill="#d7a23a" />
          {/* hindwing eyespot */}
          <circle cx="71" cy="71" r="4.8" fill="#f0e3c4" stroke="#5b231a" strokeWidth="0.6" />
          <circle cx="71" cy="71" r="2.2" fill="#3a1712" />
          {/* hindwing venation + marginal dots */}
          <g stroke="#5b231a" strokeWidth="0.55" fill="none" opacity="0.45">
            <path d="M51 54 C 60 63 67 73 74 82" />
            <path d="M51 55 C 58 60 63 68 67 78" />
          </g>
          <g fill="#d7a23a">
            <circle cx="60" cy="82" r="1.3" />
            <circle cx="68" cy="84" r="1.3" />
          </g>
          {/* antenna */}
          <path d="M50 32 C 55 21 60 16 67 12" stroke="#241f17" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <circle cx="67.3" cy="11.6" r="1.7" fill="#241f17" />
        </g>
      </defs>

      <use href="#bfHalf" />
      <use href="#bfHalf" transform="matrix(-1 0 0 1 100 0)" />

      {/* body */}
      <ellipse cx="50" cy="50" rx="2.7" ry="20" fill="#2a241b" />
      <g stroke="#120e08" strokeWidth="0.5" opacity="0.5">
        <line x1="47.5" y1="45" x2="52.5" y2="45" />
        <line x1="47.7" y1="51" x2="52.3" y2="51" />
        <line x1="48.1" y1="57" x2="51.9" y2="57" />
      </g>
      <circle cx="50" cy="31" r="3.3" fill="#2a241b" />
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
