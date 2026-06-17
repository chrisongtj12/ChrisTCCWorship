type Props = {
  available: string[]; // all section labels the song offers
  flow: string[] | null; // current order; null = natural order
  onChange: (flow: string[] | null) => void;
};

/**
 * Set the running order shown to the band (e.g. V1–C–V2–C–Bridge–C).
 * This is a REMINDER only — it does NOT change the song chart/lyrics, which
 * always display in full. Sections may repeat. "Reset" = the natural order.
 */
export function SectionFlowEditor({ available, flow, onChange }: Props) {
  const seq = flow ?? available;

  const set = (next: string[]) => onChange(next);
  const append = (label: string) => set([...seq, label]);
  const removeAt = (i: number) => set(seq.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= seq.length) return;
    const next = seq.slice();
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Song order (reminder)</span>
        <button onClick={() => onChange(null)} className="text-xs text-slate-400 underline hover:text-slate-600">
          reset to natural
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-400">Shown to the band as a running-order reminder. Doesn't change the chart.</p>

      {seq.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">No sections yet — add from below.</p>
      ) : (
        <ol className="mb-3 space-y-1">
          {seq.map((label, i) => (
            <li key={i} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm dark:bg-slate-800">
              <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
              <span className="flex-1">{label}</span>
              <button onClick={() => move(i, -1)} aria-label="up" className="px-1 text-slate-400 hover:text-sky-600">
                ↑
              </button>
              <button onClick={() => move(i, 1)} aria-label="down" className="px-1 text-slate-400 hover:text-sky-600">
                ↓
              </button>
              <button onClick={() => removeAt(i)} aria-label="remove" className="px-1 text-slate-400 hover:text-rose-500">
                ✕
              </button>
            </li>
          ))}
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
