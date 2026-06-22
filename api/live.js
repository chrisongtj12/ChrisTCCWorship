// Live "follow-the-leader" session state for a service. The leader publishes a
// small state blob (current song / key / view / scroll) with a short TTL; band
// devices read it and follow. GET is open; PUT requires the leader PIN. Backed
// by the same Vercel KV / Upstash store as the other /api functions.
// Env: LEADER_PIN + the KV vars (resolved by suffix, db_ prefix tolerated).

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

const TTL_SECONDS = 18; // session goes stale shortly after the leader stops broadcasting
const KEY = (id) => `tcclive:${id}`;

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

function validId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === "GET") return res.status(200).json({ state: null, disabled: true });
    if (req.method === "PUT") return res.status(200).json({ ok: false, disabled: true });
    return res.status(405).end();
  }

  try {
    if (req.method === "GET") {
      const id = req.query.id;
      if (!validId(id)) return res.status(400).json({ error: "bad id" });
      const raw = await kv(["GET", KEY(id)]);
      let state = null;
      if (raw) {
        try {
          state = JSON.parse(raw);
        } catch {
          state = null;
        }
      }
      return res.status(200).json({ state });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { id, state, pin, stop } = body;
      if (!validId(id)) return res.status(400).json({ error: "bad id" });
      if (!PIN) return res.status(503).json({ error: "leader PIN not configured (set LEADER_PIN env var)" });
      if (pin !== PIN) return res.status(403).json({ error: "bad pin" });

      if (stop) {
        await kv(["DEL", KEY(id)]);
        return res.status(200).json({ ok: true, stopped: true });
      }
      if (!state || typeof state !== "object") return res.status(400).json({ error: "bad state" });

      // SET with EX so the session self-expires if the leader stops heartbeating.
      await kv(["SET", KEY(id), JSON.stringify(state), "EX", String(TTL_SECONDS)]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
