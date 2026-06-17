// Client for the shared cue-notes store (E1). Talks to the /api/notes
// serverless function. Every call degrades silently: if the endpoint is
// missing (local dev) or KV isn't configured yet, reads return no notes and
// writes are no-ops, so the app falls back to the URL-hash behaviour.

export type NotesMap = Record<string, string>; // songId -> cue note
export type NotesResult = { notes: NotesMap; enabled: boolean };

export async function fetchNotes(shareId: string): Promise<NotesResult> {
  try {
    const r = await fetch(`/api/notes?id=${encodeURIComponent(shareId)}`);
    if (!r.ok) return { notes: {}, enabled: false };
    const j = await r.json();
    const notes = j && j.notes && typeof j.notes === "object" ? (j.notes as NotesMap) : {};
    return { notes, enabled: !j?.disabled };
  } catch {
    return { notes: {}, enabled: false };
  }
}

export async function saveNote(shareId: string, songId: string, note: string): Promise<boolean> {
  try {
    const r = await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shareId, songId, note }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
