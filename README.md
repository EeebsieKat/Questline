# ⚔️ Questline — Static Edition

A fully-featured, collaborative visual planning board for game development.
Infinite canvas, nested boards, sticky notes, rich notes, task lists, media
cards, code snippets, a complete flowchart system, and **live multiplayer**
— running entirely in the browser.

This is the static rewrite of the original
[Questline](https://github.com/EeebsieKat/Questline): no server, no database
to administer, no accounts required. Host it on **GitHub Pages** (or any
static host) and share a link.

## What's inside

### Canvas & boards
- Infinite drag-and-drop canvas — pan (wheel / trackpad / middle-drag), zoom
  (0.1×–3×), dot grid, minimap, zoom controls, per-board saved camera
- **Grid snapping** (16px) plus **magnetic alignment guides** with live red
  guide lines
- Marquee select by dragging empty space, Shift-click multi-select
- Right-click anywhere to add any card; double-click empty space for an
  instant sticky note; drop image/audio files straight onto the canvas
- **Nested boards** — a Home board plus unlimited sub-boards (starter
  workspace ships with Game Lore, Mechanics, Level Design, Character Sheets,
  Art Assets), board cards on the parent canvas, sidebar tree with search,
  per-board emoji icon, inline rename, breadcrumbs
- `Ctrl/Cmd + K` command palette — jump to any board or run any action
- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`), duplicate (`Ctrl+D`)

### Cards (full parity with the original)
- **Sticky notes** — pastel colors, slight hand-placed rotation
- **Rich notes** — heading/paragraph/bullet/checklist blocks
- **Task lists** — checkboxes with a live progress bar
- **Images** — upload (auto-compressed) or embed by URL, captions, resize
- **Audio** — upload sfx/music sketches with an inline player
- **Web links** — titled, described, one-click open
- **Code snippets** — syntax highlighting for GDScript, TypeScript,
  JavaScript, Python, Lua, C#, C++, GLSL, JSON, Shell
- **Flowchart shapes** — process, decision (diamond), start/end (stadium),
  input/output (parallelogram)
- Every card: color palette, tags, duplicate, bring-to-front, delete, resize

### Connectors
- Drag from any card's edge dots (all four sides)
- Elbow (rounded/sharp), bezier, or straight routing
- Inline labels (double-click), 7 line colors, animated dashes, arrowheads
  on either/both ends — floating toolbar on the selected connector

### Collaboration
- **Live cursors** — see collaborators' colored cursors with names, and a
  who's-online list
- Remote selection glow — cards others have selected light up in their color
- Conflict-free merging (Yjs CRDTs) — everyone can type at once

## How the data works

| Layer | What it does | When |
| --- | --- | --- |
| **IndexedDB** | Instant local saves — your browser always has the full workspace | Always on |
| **WebRTC (P2P)** | Live sync + cursors with everyone on the same share link, no server involved | Always on |
| **Firebase (optional)** | Cloud persistence (Firestore) + Google sign-in + invite-by-email — edits sync even when nobody is online | If you paste a config |

Without Firebase: everyone on the link syncs live **while online at the same
time**, and each browser keeps its own copy. With Firebase: the workspace is
also persisted to the cloud, so edits sync whenever anyone comes back online,
and only invited Google accounts can get in.

## Deploy to GitHub Pages (2 minutes)

1. Push this project to a GitHub repo (or drop these files into yours,
   replacing the old Next.js app — keep the old code on a branch if you like).
2. In the repo: **Settings → Pages → Build and deployment → Source:
   GitHub Actions**.
3. Push to `main` — the included workflow (`.github/workflows/deploy.yml`)
   builds and deploys automatically.

Your board is live at `https://<username>.github.io/<repo>/`.

> The build uses `base: "./"` (relative assets), so it works on project
> pages, user pages, and custom domains without changes.

## Optional: cloud sync + Google-gated access (~10 min, free)

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com)
   (Spark plan is plenty — no credit card).
2. **Project settings → Your apps → Web app** → copy the `firebaseConfig`
   object.
3. **Authentication → Sign-in method → Google → Enable.**
4. Still in Authentication → **Settings → Authorized domains → Add** your
   GitHub Pages domain (e.g. `yourname.github.io`).
5. **Firestore Database → Create database** (production mode, any region).
6. **Firestore → Rules** → paste the contents of
   [`firestore.rules`](./firestore.rules) → Publish.
7. **Recommended: bake it in once** — paste the `firebaseConfig` object
   into `src/firebase-config.ts`, commit and push. From then on nobody
   pastes anything: visitors click **Sign in with Google** in the top bar.
   (Per-browser alternative: **Settings → Cloud sync** → paste → **Save &
   connect**.)
8. **Share** → invite teammates by Google email. They open the same link,
   sign in with Google, and get edit access; anyone else is blocked.

Notes:
- The config is baked into the build (`src/firebase-config.ts`) or pasted
  per-browser (localStorage). Firebase web configs are public identifiers —
  security comes from the rules above.
- Firestore stores an append-only log of Yjs updates (auto-compacted).
  Free-tier quotas (≈50k reads / 20k writes per day) are far more than a
  small team needs.
- Media limits: images are auto-compressed to stay under ~1 MB; keep audio
  under ~1.4 MB or link it by URL.

## Development

```bash
npm install
npm run dev       # vite dev server
npm run build     # typecheck + production build → dist/
npm run preview   # serve the production build locally
```

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 (dark game-dev theme) |
| Canvas | React Flow (`@xyflow/react` v12) |
| Collab | **Yjs** + y-webrtc + y-indexeddb (+ optional Firebase/Firestore) |
| State | Zustand |
| Icons | lucide-react |

## Migrating from the original Questline

The original stores data in a server-side SQLite file, which a static site
can't read. Export boards from the old app as needed, or just start fresh —
the starter workspace is the same. Backups here are portable JSON
(**Settings → Export backup**) containing every board, card and asset.

## Troubleshooting

- **Live sync doesn't connect** — corporate networks sometimes block WebRTC.
  The default public signaling servers can be overridden in Settings →
  Cloud sync → advanced (e.g. self-host
  `node node_modules/y-webrtc/bin/server.js`). Cloud sync (Firebase) is
  unaffected by WebRTC blocks.
- **"This domain is not authorized"** during Google sign-in — add your
  GitHub Pages domain in Firebase Auth → Settings → Authorized domains.
- **Permission denied** in the cloud status — publish the `firestore.rules`
  and make sure you're signed in with an invited account.
