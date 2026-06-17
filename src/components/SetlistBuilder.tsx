import { useMemo, useState } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist, SetEntry, Notation, View, SavedSetlist } from "../lib/setlist.ts";
import {
  shareUrl,
  encodeSetlist,
  loadSavedSets,
  saveNamedSet,
  deleteSavedSet,
  exportSavedCode,
  importSavedCode,
} from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { availableSections } from "../lib/song.ts";
import { Segmented, Btn, CapoSelect } from "./ui.tsx";
import { SectionFlowEditor } from "./SectionFlowEditor.tsx";

type Props = {
  songs: Song[];
  set: Setlist;
  onChange: (set: Setlist) => void;
};

export function SetlistBuilder({ songs, set, onChange }: Props) {
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedSetlist[]>(() => loadSavedSets());

  const update = (patch: Partial<Setlist>) => onChange({ ...set, ...patch });
  const updateEntry = (i: number, patch: Partial<SetEntry>) =>
    update({ entries: set.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const remove = (i: number) => update({ entries: set.entries.filter((_, j) => j !== i) });

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = set.entries.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ entries: next });
  };

  // Pointer-based drag — works with mouse AND touch (HTML5 DnD doesn't on touch).
  const onHandleDown = (e: React.PointerEvent, i: number) => {
    setDragIdx(i);
    setOverIdx(i);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const li = el?.closest("[data-idx]") as HTMLElement | null;
    if (li) {
      const idx = Number(li.dataset.idx);
      if (!Number.isNaN(idx) && idx !== overIdx) setOverIdx(idx);
    }
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (dragIdx !== null && overIdx !== null) reorder(dragIdx, overIdx);
    setDragIdx(null);
    setOverIdx(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(set));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked; readonly field below still works */
    }
  };

  const play = () => {
    window.location.hash = "s=" + encodeSetlist(set);
  };

  const exportSets = async () => {
    const code = exportSavedCode();
    try {
      await navigator.clipboard.writeText(code);
      alert("Saved-sets code copied. On another device, tap Import and paste it.");
    } catch {
      window.prompt("Copy this saved-sets code:", code);
    }
  };
  const importSets = () => {
    const code = window.prompt("Paste a saved-sets code:");
    if (!code) return;
    try {
      setSaved(importSavedCode(code));
    } catch {
      alert("Sorry, that code couldn't be read.");
    }
  };

  const link = set.entries.length ? shareUrl(set) : "";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Saved sets */}
      <div className="mb-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSaved(saveNamedSet(set))}
            disabled={set.entries.length === 0}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-40"
          >
            Save set
          </button>
          <button
            onClick={() => onChange({ name: "", date: "", entries: [] })}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            New set
          </button>
          <button
            onClick={exportSets}
            disabled={saved.length === 0}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Export
          </button>
          <button
            onClick={importSets}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Import
          </button>
          <span className="text-xs text-slate-400">Saved on this device.</span>
        </div>
        {saved.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 text-xs dark:border-slate-700"
              >
                <button
                  onClick={() => onChange({ name: s.name, date: s.date, entries: s.entries })}
                  className="px-3 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Load this set"
                >
                  {s.name} <span className="text-slate-400">· {s.entries.length}</span>
                </button>
                <button
                  onClick={() => setSaved(deleteSavedSet(s.id))}
                  className="border-l border-slate-200 px-2 py-1 text-slate-400 hover:text-rose-500 dark:border-slate-700"
                  title="Delete"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={set.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Setlist name (e.g. Sunday 9am)"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <input
          value={set.date}
          onChange={(e) => update({ date: e.target.value })}
          placeholder="Date (e.g. 21 Jun 2026)"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {set.entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          No songs yet. Go to the <strong>Library</strong> tab and tap <strong>+ Add to setlist</strong>.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-400">Drag the &#10303; handle to reorder songs.</p>
          <ol className="space-y-3">
            {set.entries.map((entry, i) => {
              const song = byId.get(entry.songId);
              if (!song) return null;
              const sounding = song.key ? transposeKey(song.key, entry.transpose) : null;
              const sections = availableSections(song);
              const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <li
                  key={i}
                  data-idx={i}
                  className={
                    "rounded-xl bg-white p-3 shadow-sm transition dark:bg-slate-900 " +
                    (dragIdx === i ? "opacity-50 " : "") +
                    (isOver ? "ring-2 ring-sky-500" : "")
                  }
                >
                  <div className="flex items-start gap-2">
                    <div
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      title="Drag to reorder"
                      className="cursor-grab touch-none select-none pt-0.5 text-lg leading-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                    >
                      &#10303;
                    </div>
                    <span className="w-5 pt-1 text-right text-sm text-slate-400">{i + 1}</span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-medium">{song.title}</div>
                        <button onClick={() => remove(i)} className="text-xs text-slate-400 hover:text-rose-500">
                          remove
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <Btn onClick={() => updateEntry(i, { transpose: entry.transpose - 1 })} aria="key down">
                            &ndash;
                          </Btn>
                          <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">
                            {sounding ?? "key?"}
                          </span>
                          <Btn onClick={() => updateEntry(i, { transpose: entry.transpose + 1 })} aria="key up">
                            +
                          </Btn>
                        </div>
                        <CapoSelect value={entry.capo} onChange={(c) => updateEntry(i, { capo: c })} />
                        <Segmented
                          size="sm"
                          value={entry.view}
                          onChange={(v) => updateEntry(i, { view: v as View })}
                          options={[
                            { value: "chart", label: "Chart", disabled: !song.choRaw },
                            { value: "lyrics", label: "Lyrics", disabled: !song.lyrics },
                          ]}
                        />
                        <Segmented
                          size="sm"
                          value={entry.notation}
                          onChange={(v) => updateEntry(i, { notation: v as Notation })}
                          options={[
                            { value: "names", label: "Names" },
                            { value: "roman", label: "Roman" },
                          ]}
                        />
                        <button
                          onClick={() => setExpanded(expanded === i ? null : i)}
                          className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-sky-400 dark:border-slate-700 dark:text-slate-300"
                        >
                          {entry.flow ? `Order (${entry.flow.length})` : "Order"}
                        </button>
                      </div>

                      <textarea
                        value={entry.note}
                        onChange={(e) => updateEntry(i, { note: e.target.value })}
                        rows={2}
                        placeholder="Cue notes (e.g. start a cappella, key change after bridge, drums in at C2)"
                        className="mt-2 w-full resize-y rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 placeholder:text-amber-400 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100"
                      />

                      {expanded === i && (
                        <div className="mt-3">
                          <SectionFlowEditor
                            available={sections}
                            flow={entry.flow}
                            onChange={(flow) => updateEntry(i, { flow })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {set.entries.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={play}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              ▶ Play set
            </button>
            <button
              onClick={share}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              {copied ? "Link copied ✓" : "Copy share link"}
            </button>
          </div>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800"
          />
          <p className="mt-2 text-xs text-slate-400">
            Send this link to the team — it opens a read-only view of the set with each song's key, capo, and
            section order. The whole setlist is encoded in the link, so it works without anyone logging in.
          </p>
        </div>
      )}
    </div>
  );
}
