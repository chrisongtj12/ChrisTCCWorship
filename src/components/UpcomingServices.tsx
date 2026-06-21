import { useMemo } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist } from "../lib/setlist.ts";
import { encodeSetlist } from "../lib/setlist.ts";
import { ROSTER, serviceToSetlist, type Service } from "../data/roster.ts";

type Props = {
  songs: Song[];
  onEdit: (set: Setlist) => void;
};

export function UpcomingServices({ songs, onEdit }: Props) {
  const titleById = useMemo(() => new Map(songs.map((s) => [s.id, s.title])), [songs]);

  const play = (svc: Service) => {
    window.location.hash = "s=" + encodeSetlist(serviceToSetlist(svc));
  };

  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Upcoming Services</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ROSTER.map((svc) => (
          <div
            key={svc.date}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{svc.display}</div>
                {svc.theme && <div className="text-sm font-medium text-amber-600 dark:text-amber-400">{svc.theme}</div>}
                <div className="text-sm text-sky-600">{svc.leader}</div>
              </div>
              <button
                onClick={() => play(svc)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
              >
                ▶ Play
              </button>
            </div>

            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {svc.entries.map((e, i) => (
                <li key={i} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {e.role}
                  </span>
                  <span className="text-sm">{titleById.get(e.songId) ?? e.songId}</span>
                </li>
              ))}
            </ol>

            <button
              onClick={() => onEdit(serviceToSetlist(svc))}
              className="mt-3 text-xs text-slate-400 underline hover:text-sky-600"
            >
              Edit in builder
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
