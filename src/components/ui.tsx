import type { ReactNode } from "react";

export function Btn({ children, onClick, aria }: { children: ReactNode; onClick: () => void; aria: string }) {
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

export function Segmented({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <div className="fgseg inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={
            "rounded-md transition " +
            pad +
            " " +
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

export function CapoSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="text-slate-400">Capo</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </label>
  );
}
