# Deploying to Vercel

The app is ready to deploy. I couldn't do it from here because it needs your Vercel/GitHub login, but it's a 2-minute job. Two ways — the GitHub path is best because every future `git push` auto-redeploys.

## First, clean up local cruft (once)

In the project folder, delete the `node_modules` folder (it got left behind by the sandbox; it's gitignored and will be reinstalled fresh). Then:

```bash
npm install      # reinstall cleanly
npm run dev      # optional: check it locally first
```

## Option A — GitHub + Vercel (recommended)

```bash
# in the project folder
git init
git add -A
git commit -m "Phase 0: TCC setlist viewer"
```

1. Create a new repo on github.com (public is fine) — don't add a README, we have one.
2. Connect and push:

   ```bash
   git remote add origin https://github.com/<you>/tcc-setlist.git
   git branch -M main
   git push -u origin main
   ```

3. Go to vercel.com → **Add New → Project** → import the repo. Vercel auto-detects Vite and runs `npm run build`. Click **Deploy**.

You'll get a URL like `tcc-setlist.vercel.app`. Share that with the worship team. Every `git push` redeploys automatically.

## Option B — Vercel CLI (no GitHub)

```bash
npm i -g vercel
vercel          # follow prompts, link to your account
vercel --prod   # deploy to production
```

## Adding songs later

Drop the `.cho` + `.docx` into `songs/`, commit, push (Option A) or `vercel --prod` (Option B). `songs.json` is regenerated automatically by the build — never commit it.

## Notes

- The repo is set up for a public repo with ~4 viewers. Charts are used under your CCLI licence (#301143); keep the link to the worship team.
- `node_modules/` and `public/songs.json` are gitignored — only your source and the `songs/` files get committed.
