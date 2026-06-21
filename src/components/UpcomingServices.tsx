import { useMemo } from "react";
import type { Song } from "../lib/types.ts";
import type { Setlist } from "../lib/setlist.ts";
import { encodeSetlist } from "../lib/setlist.ts";
import { transposeKey } from "../lib/chordpro.ts";
import { serviceToSetlist, type Service } from "../data/roster.ts";

type Props = {
  services: Service[];
  songs: Song[];
  onEdit: (set: Setlist) => void;
};

export function UpcomingServices({ services, songs, onEdit }: Props) {
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const play = (svc: Service) => {
    window.location.hash = "s=" + encodeSetlist(serviceToSetlist(svc));
  };

  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-bold tracking-tight">Upcoming Services</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {services.map((svc) => (
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
              {serviceToSetlist(svc).entries.map((e, i) => {
                const song = byId.get(e.songId);
                const key = song?.key ? transposeKey(song.key, e.transpose) : null;
                return (
                  <li key={i} className="flex items-baseline gap-3 py-1.5">
                    <span className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {e.role}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      {song?.title ?? e.songId}
                      {e.note && (
                        <span className="mt-0.5 block text-xs italic text-slate-400">{e.note}</span>
                      )}
                    </span>
                    {key && <span className="shrink-0 text-xs font-medium text-sky-600">{key}</span>}
                  </li>
                );
              })}
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
