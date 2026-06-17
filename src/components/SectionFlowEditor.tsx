import { useState } from "react";

type Props = {
  available: string[]; // all section labels the song offers
  flow: string[] | null; // current order; null = natural order
  onChange: (flow: string[] | null) => void;
};

/**
 * Set the running order shown to the band (e.g. V1–C–V2–C–Bridge–C).
 * REMINDER only — does NOT change the chart/lyrics, which always show in full.
 * Reorder by dragging the ⠿ handle (works on mouse and touch).
 */
export function SectionFlowEditor({ available, flow, onChange }: Props) {
  const seq = flow ?? available;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const set = (next: string[]) => onChange(next);
  const append = (label: string) => set([...seq, label]);
  const removeAt = (i: number) => set(seq.filter((_, j) => j !== i));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = seq.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set(next);
  };

  const down = (e: React.PointerEvent, i: number) => {
    setDragIdx(i);
    setOverIdx(i);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const moveP = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const li = el?.closest("[data-oidx]") as HTMLElement | null;
    if (li) {
      const idx = Number(li.dataset.oidx);
      if (!Number.isNaN(idx) && idx !== overIdx) setOverIdx(idx);
    }
  };
  const up = (e: React.PointerEvent) => {
    if (dragIdx !== null && overIdx !== null) reorder(dragIdx, overIdx);
    setDragIdx(null);
    setOverIdx(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Song order (reminder)</span>
        <button onClick={() => onChange(null)} className="text-xs text-slate-400 underline hover:text-slate-600">
          reset to natural
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-400">Drag ⠿ to reorder. Reminder only — doesn't change the chart.</p>

      {seq.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">No sections yet — add from below.</p>
      ) : (
        <ol className="mb-3 space-y-1">
          {seq.map((label, i) => {
            const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
            return (
              <li
                key={i}
                data-oidx={i}
                className={
                  "flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm dark:bg-slate-800 " +
                  (dragIdx === i ? "opacity-50 " : "") +
                  (isOver ? "ring-2 ring-sky-500" : "")
                }
              >
                <span
                  onPointerDown={(e) => down(e, i)}
                  onPointerMove={moveP}
                  onPointerUp={up}
                  title="Drag to reorder"
                  className="cursor-grab touch-none select-none text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                >
                  ⠿
                </span>
                <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
                <span className="flex-1">{label}</span>
                <button onClick={() => removeAt(i)} aria-label="remove" className="px-1 text-slate-400 hover:text-rose-500">
                  ✕
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap gap-1.5">
        {available.map((label) => (
          <button
            key={label}
            onClick={() => append(label)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}
