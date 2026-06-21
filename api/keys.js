// Shared song-key store. Holds global default keys per song and per-set keys per
// (service, song), as transpose offsets. GET is open (everyone reads the same
// keys with no share link); PUT requires the leader PIN, so the band is
// read-only. Backed by the same Vercel KV / Upstash store as /api/notes.
//
// Env (in addition to the KV vars): LEADER_PIN — the shared edit PIN. Without it,
// writes are rejected (reads still work).

function findEnv(...suffixes) {
  for (const key of Object.keys(process.env)) {
    for (const suf of suffixes) {
      if (key === suf || key.endsWith("_" + suf)) return process.env[key];
    }
  }
  return undefined;
}

const KV_URL = findEnv("KV_REST_API_URL", "UPSTASH_REDIS_REST_URL");
const KV_TOKEN = findEnv("KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN");
const PIN = process.env.LEADER_PIN;

const DOC = "tcckeys:v1";
const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const clampT = (t) => Math.max(-12, Math.min(12, Math.round(t)));

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

async function readDoc() {
  const raw = await kv(["GET", DOC]);
  if (!raw) return { song: {}, set: {} };
  try {
    const o = JSON.parse(raw);
    return { song: o.song && typeof o.song === "object" ? o.song : {}, set: o.set && typeof o.set === "object" ? o.set : {} };
  } catch {
    return { song: {}, set: {} };
  }
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === "GET") return res.status(200).json({ song: {}, set: {}, disabled: true });
    if (req.method === "PUT") return res.status(200).json({ ok: false, disabled: true });
    return res.status(405).end();
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json(await readDoc());
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { scope, songId, shareId, transpose, pin } = body;
      if (!PIN) return res.status(503).json({ error: "leader PIN not configured (set LEADER_PIN env var)" });
      if (pin !== PIN) return res.status(403).json({ error: "bad pin" });
      if (typeof transpose !== "number") return res.status(400).json({ error: "bad transpose" });
      const t = clampT(transpose);

      const doc = await readDoc();
      if (scope === "song" && validId(songId)) {
        doc.song[songId] = t;
      } else if (scope === "set" && validId(shareId) && validId(songId)) {
        (doc.set[shareId] = doc.set[shareId] || {})[songId] = t;
      } else {
        return res.status(400).json({ error: "bad scope" });
      }
      await kv(["SET", DOC, JSON.stringify(doc)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
