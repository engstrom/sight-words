# Sight Words

A kid's sight-word reading practice app for the iPad: one page (`public/index.html`) plus a small Cloudflare Worker that syncs progress between devices. Live at https://sight-words.formworkstudios.workers.dev.

- `public/` is the site, served as static files: the app, its service worker (network first), manifest and icons.
- `src/worker.js` answers `/api/sync/CODE` and nothing else. There are no accounts: a family's progress is one row in D1 keyed by a random 20-character code, which Grown-ups › Sync shows and the other devices enter. A write names the version it was made on top of; a stale one is refused and that device takes the stored copy instead.
- `migrations/` is the D1 schema.

```
nvm use                # Node 22
npm install
npm run dev            # http://localhost:8787 with a local D1
npm run deploy         # applies migrations to the real D1, then deploys
```

Progress also lives in the browser under `localStorage["sightwords.v1"]`, so the app works offline and syncs when it's back. Grown-ups › Backup still saves and restores it as a file.

The first version was hosted on GitHub Pages at https://engstrom.github.io/sight-words/, served from the `gh-pages` branch.
