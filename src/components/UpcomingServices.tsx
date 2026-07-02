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

  // Show only current/future services (a service stays visible through the day
  // after, for post-service reference). Past ones remain in the shared store.
  const visible = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 1);
    return services.filter((s) => new Date(s.date + "T00:00:00") >= cutoff);
  }, [services]);

  const play = (svc: Service) => {
    window.location.hash = "s=" + encodeSetlist(serviceToSetlist(svc));
  };

  return (
    <div className="mb-5">
      <div className="fg-rule mb-4 flex items-baseline justify-between pb-2">
        <h2 className="text-xl font-bold tracking-tight">Upcoming Services</h2>
        <span className="fg-count">
          {visible.length} {visible.length === 1 ? "service" : "services"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((svc, i) => (
          <div
            key={svc.date}
            style={{ animationDelay: `${i * 80}ms` }}
            className="fg-rise rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{svc.display}</div>
                {svc.theme && <div className="text-sm font-medium text-amber-600 dark:text-amber-400">{svc.theme}</div>}
                <div className="text-sm text-sky-600">{svc.leader}</div>
              </div>
              <button
                onClick={() => play(svc)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-500 active:scale-95"
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
