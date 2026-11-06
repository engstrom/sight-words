# Sight Words

Sight-word practice run by the grown-ups: a word fills your phone or tablet screen, the child reads it, and you tap **Right**, **Wrong** or **Skip**. The app picks which words to practise (spaced repetition), and every grown-up with the share link sees and adds to the same progress. Live at https://sight-words.formworkstudios.workers.dev.

It is one page (`public/index.html`) plus a small Cloudflare Worker with a D1 database.

- `public/` is the site, served as static files: the app, its service worker (network first), manifest and icons.
- `src/worker.js` answers `/api/sync/CODE` and `/api/answers/CODE` and nothing else. There are no accounts: one child's progress is keyed by a random 20-character code, which travels in the share link (`/#join=CODE`) and is also shown in Settings.
  - **The record** (`progress` table): the child's name, word list, settings, and the progress the answers build on. It syncs whole; a write names the version it was made on top of, a stale one is refused and that phone takes the stored copy instead.
  - **The answer log** (`answers` table): one row per tap, only ever added to. Phones send theirs and fetch everyone else's, and each works out the progress by replaying the log in the order the answers were given. A phone that quizzed offline sends its answers later, and nothing is lost.
- `migrations/` is the D1 schema.

```
nvm use                # Node 22
npm install
npm run dev            # http://localhost:8787 with a local D1
npm run deploy         # applies migrations to the real D1, then deploys
```

Each phone keeps its copy in `localStorage["sightwords.v2"]`, so quizzing works offline. Settings › Backup saves and restores progress as a file. Progress from the earlier kid-and-microphone version (`sightwords.v1`, and its sync code) carries over the first time the new version opens.
