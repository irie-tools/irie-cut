# Irie Cut

[![CI](https://github.com/irie-tools/irie-cut/actions/workflows/ci.yml/badge.svg)](https://github.com/irie-tools/irie-cut/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A free, open, in-browser video editor.** Import clips, cut and layer them on a
multi-track timeline, grade them, add titles and captions, cut to the beat of a song,
score the cut, and export an MP4 — no account, no watermark, nothing uploaded. Your
media lives in the browser (IndexedDB) and every frame is rendered on-device. Zero
network calls, period.

<img width="1687" height="787" alt="Irie Cut's multi-track editor open on a real project — captions, visuals and song tracks on the timeline, sound-bar visualizer settings on the right" src="https://github.com/user-attachments/assets/05e002a2-31af-4dcf-a1a2-b824b1e9411d" />

*The real editor, mid-project — multi-track timeline, sound-bar visualizer, everything rendered on-device.*

Irie Cut began as a rebuild on top of the [OpenCut](https://github.com/opencut-app/opencut)
rewrite scaffold (MIT) and is developed independently — the scaffold provided project
tooling; the editor itself (rendering, export, effects, audio, beat-cutting) was built
from there.

> **New here? Read [ARCHITECTURE.md](ARCHITECTURE.md)** — the code graph: an annotated
> map of every file, how the pieces connect, the core data flows, and where to add things.
> AI agents should start at [AGENTS.md](AGENTS.md).

---

## Features

**Editing**
- Multi-track timeline — video, image, audio and text tracks; drag-to-move with **snapping**, edge-trim, split at the playhead, duplicate, **ripple delete**, markers, zoom-to-fit.
- Track headers — rename, mute, solo, lock, per-track volume, reorder, delete.
- Per-clip **transform** (scale, opacity, rotation, x/y), **speed** (0.25–4×), and color-grade **filters**.
- Per-clip **quality helpers** — enhance and noise reduction, baked into preview and export.
- **Transitions** — fade, slide (4 dirs), zoom in/out, wipe — per-clip in/out, composited into preview *and* export.
- **Undo/redo** with gesture coalescing (a drag or slider sweep is one step).
- Timeline polish — video **filmstrip thumbnails** and decoded **audio waveforms** on clips.

**Effects & compositing**
- Color adjustments (brightness/contrast/saturation/hue), composed with filter presets.
- 17 blend modes; reveal masks (rectangle/ellipse/linear, feathered, invertible).
- A real WebGL **chroma key** (green screen).

**Preview & export**
- Canvas preview with real-time playback, synced audio, master volume.
- **Audio mixing** — clip × track × master gain, mute/solo, fade envelopes — identical in preview and export.
- **In-browser MP4 export**, including a frame-accurate WebCodecs path for higher quality/speed.

**Music & beat-cutting**
- **Beat-cut** — cut selected clips or stills to the beat of a song on the timeline; media-agnostic (`lib/beat-cut.ts`, `lib/beat-detect.ts`).
- **Cover motion** — a cinematic multi-phase Ken-Burns push, plus a motion preset menu (`lib/motion.ts`).
- **Sound bar** — an on-frame audio spectrum visualizer (FFT), mirrored so the bass pumps at both ends, with a bass-colour flash; bakes into the export (`lib/audio-spectrum.ts`).

**Producer touches**
- Format templates (UGC Reel, Square, Widescreen, Vertical Quote, YouTube Music Video) that set the canvas and drop a starter layout.
- **Captions** → valid `.srt` / `.vtt` export from text-clip timing.
- **Export readiness scorecard** — a real 0–100 score with inline fixes for length, caption coverage, audio, pacing, aspect, blank openings, visual gaps, text safe zones and audio balance.
- A small shared **brand kit** — save a color palette and font, apply to text in one click.

**Private by default** — projects and media persist in IndexedDB. There is no server
component and no network calls of any kind; the editor runs entirely offline once loaded.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TanStack Router (file-based), Tailwind v4, base-ui / shadcn components, lucide icons |
| State | zustand (single editor store with undo/redo) |
| Persistence | IndexedDB (projects, media metadata, media blobs) |
| Rendering | HTML Canvas 2D compositor (shared by preview + export) |
| Audio | Web Audio API (mixing graph in export; element gain in preview) |
| Build | Vite 8 → static SPA |

There is no backend of any kind. This is a pure client-side single-page app — build it,
host the static output anywhere, done.

---

## Project structure

```text
irie-cut/
├── apps/
│   └── web/                  the editor SPA (Vite)
│       ├── index.html        SPA entry
│       ├── src/
│       │   ├── main.tsx              app bootstrap (router + providers)
│       │   ├── routes/              file-based routes (landing, projects, editor)
│       │   ├── components/editor/   the editor UI (timeline, preview, panels, dialogs)
│       │   ├── components/ui/       shadcn/base-ui primitives
│       │   ├── stores/             editor-store.ts (single source of truth)
│       │   ├── lib/                pure logic (renderer, exporter, audio, filters, …)
│       │   ├── hooks/              playback clock, waveform decode
│       │   ├── types/editor.ts     domain types
│       │   └── styles.css          Tailwind theme
│       └── vite.config.ts
├── ARCHITECTURE.md           the code graph (read this to navigate the repo)
├── AGENTS.md                 orientation for AI coding agents
└── ROADMAP.md                feature history and what's next
```

Full per-file annotations and the module/data-flow diagram are in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Development

Uses [proto](https://moonrepo.dev/proto) to pin `bun` + `moon` (versions in `.prototools`):

```sh
proto use            # installs bun + moon
cd apps/web
bun install
bun run dev          # http://localhost:5173
```

Build the static site:

```sh
cd apps/web
bun run build        # outputs apps/web/dist
```

---

## Deployment

The web app is a static SPA built from `apps/web` — the build output in `apps/web/dist`
can be hosted anywhere that serves static files (Vercel, Netlify, Cloudflare Pages, GitHub
Pages, your own server). No environment variables, no backend, no serverless functions
required.

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and the project's hard rules (shared
renderer, `mutate()`-only edits, client-only core). Issues labeled
[`good first issue`](https://github.com/irie-tools/irie-cut/labels/good%20first%20issue) are
scoped small on purpose — a good place to start.

## License

[MIT](LICENSE)
