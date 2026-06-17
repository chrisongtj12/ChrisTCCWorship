// Shared cue-notes store (E1) — notes only; the setlist itself still travels
// in the share URL. Keyed by the set's shareId. Backed by Vercel KV / Upstash
// Redis via its REST API (no extra npm dependency — uses global fetch).
//
// Env (injected by Vercel when you attach a KV / Upstash store). Accepts both
// the classic Vercel KV names and the Upstash-direct names:
//   KV_REST_API_URL / KV_REST_API_TOKEN   (Vercel KV)
//   UPSTASH_REDIS_REST_URL / ..._TOKEN    (Upstash marketplace)
// If they're absent the endpoint is a graceful no-op, so the site keeps
// working exactly as before until KV is enabled.

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const PREFIX = "tccnotes:";
const MAX_NOTE = 2000; // chars per cue note
const MAX_NOTES = 100; // distinct songs per set

const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

// Run one Redis command via the Upstash REST API (command-array form).
async function kv(command) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const j = await r.json();
  return j.result;
}

async function readNotes(id) {
  const raw = await kv(["GET", PREFIX + id]);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  // KV not configured yet → behave as a no-op (notes fall back to the URL).
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === "GET") return res.status(200).json({ notes: {}, disabled: true });
    if (req.method === "PUT") return res.status(200).json({ ok: true, disabled: true });
    return res.status(405).end();
  }

  try {
    if (req.method === "GET") {
      const id = req.query.id;
      if (!validId(id)) return res.status(400).json({ error: "bad id" });
      return res.status(200).json({ notes: await readNotes(id) });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { id, songId, note } = body;
      if (!validId(id) || typeof songId !== "string" || !songId) {
        return res.status(400).json({ error: "bad input" });
      }
      const notes = await readNotes(id);
      const text = typeof note === "string" ? note.slice(0, MAX_NOTE) : "";
      if (text) notes[songId] = text;
      else delete notes[songId];
      if (Object.keys(notes).length > MAX_NOTES) {
        return res.status(413).json({ error: "too many notes" });
      }
      await kv(["SET", PREFIX + id, JSON.stringify(notes)]);
      return res.status(200).json({ ok: true, notes });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
