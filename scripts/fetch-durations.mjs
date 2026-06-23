// Fetch song durations from Spotify and cache them in songs/durations.json
// (committed, so the Vercel build never needs Spotify credentials).
//
// Setup: create a free app at https://developer.spotify.com/dashboard, then
//   export SPOTIFY_CLIENT_ID=...  SPOTIFY_CLIENT_SECRET=...
// Usage: npm run durations   (runs build:songs first to get the song list)
//
// Only songs missing from durations.json are looked up; delete a line to refresh.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SONGS_JSON = join(root, "public", "songs.json");
const OUT = join(root, "songs", "durations.json");

const ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET = process.env.SPOTIFY_CLIENT_SECRET;
if (!ID || !SECRET) {
  console.error(
    "Missing Spotify creds. Create an app at https://developer.spotify.com/dashboard, then\n" +
      "  export SPOTIFY_CLIENT_ID=...  SPOTIFY_CLIENT_SECRET=..."
  );
  process.exit(1);
}

async function getToken() {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${ID}:${SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("Spotify token failed: " + r.status);
  return (await r.json()).access_token;
}

async function durationFor(tok, title, artist) {
  const clean = title.replace(/\(.*?\)/g, "").trim(); // drop "(Psalm 145)" etc.
  const q = `track:${clean}${artist ? ` artist:${artist}` : ""}`;
  const r = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${tok}` } }
  );
  if (!r.ok) return null;
  const t = (await r.json()).tracks?.items?.[0];
  return t ? Math.round(t.duration_ms / 1000) : null;
}

const songs = JSON.parse(readFileSync(SONGS_JSON, "utf8")).songs;
let cache = {};
try {
  cache = JSON.parse(readFileSync(OUT, "utf8"));
} catch {
  /* first run */
}

const tok = await getToken();
let added = 0;
for (const s of songs) {
  if (cache[s.id]) continue;
  const firstArtist = (s.artist || "").split(/[,&]/)[0].trim();
  const dur = await durationFor(tok, s.title, firstArtist);
  if (dur) {
    cache[s.id] = dur;
    added++;
    console.log(`  ${s.title} → ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`);
  } else {
    console.log(`  ${s.title} → not found (add manually to songs/durations.json)`);
  }
}

const sorted = Object.fromEntries(Object.entries(cache).sort());
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\nsongs/durations.json: ${Object.keys(cache).length} songs (${added} new)`);
