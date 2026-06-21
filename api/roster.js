// Shared services roster. GET is open (everyone sees the leader's services with
// no share link); PUT upserts a service and requires the leader PIN. Backed by
// the same Vercel KV / Upstash store as /api/notes and /api/keys.
// Env: LEADER_PIN (shared edit PIN) in addition to the KV vars.

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

const DOC = "tccroster:v1";
const MAX_SERVICES = 60;

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

async function readList() {
  const raw = await kv(["GET", DOC]);
  if (!raw) return [];
  try {
    const o = JSON.parse(raw);
    return Array.isArray(o.services) ? o.services : [];
  } catch {
    return [];
  }
}

function validService(s) {
  return (
    s &&
    typeof s.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
    Array.isArray(s.entries) &&
    s.entries.length <= 50
  );
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    if (req.method === "GET") return res.status(200).json({ services: [], disabled: true });
    if (req.method === "PUT") return res.status(200).json({ ok: false, disabled: true });
    return res.status(405).end();
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ services: await readList() });
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { service, pin } = body;
      if (!PIN) return res.status(503).json({ error: "leader PIN not configured (set LEADER_PIN env var)" });
      if (pin !== PIN) return res.status(403).json({ error: "bad pin" });
      if (!validService(service)) return res.status(400).json({ error: "bad service" });

      const list = await readList();
      const i = list.findIndex((s) => s.date === service.date);
      if (i >= 0) list[i] = service;
      else list.push(service);
      list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (list.length > MAX_SERVICES) return res.status(413).json({ error: "too many services" });

      await kv(["SET", DOC, JSON.stringify({ services: list })]);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
