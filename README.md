# Irie Cut

**A free, open, in-browser media studio.** Import clips, cut and layer them on a
multi-track timeline, grade them, add titles and captions, score the cut, and
export an MP4 — with no account, no watermark, and nothing uploaded. Your media
lives in the browser (IndexedDB) and every frame is rendered on-device.

Live: **https://irie-cut.vercel.app**

Irie Cut began as a rebuild on top of the [OpenCut](https://github.com/opencut-app/opencut)
rewrite scaffold (MIT) and is developed independently. Where producer features were
inspired by an earlier media-studio prototype, they were re-implemented here as real,
working features (the prototype's were largely placeholders).

> **New here? Read [ARCHITECTURE.md](ARCHITECTURE.md)** — the code graph: an annotated
> map of every file, how the pieces connect, the core data flows, and where to add things.
> AI agents should start at [AGENTS.md](AGENTS.md).

---

## Features

**Editing**
- Multi-track timeline — video, image, audio and text tracks; drag-to-move with **snapping**, edge-trim, split at the playhead, duplicate, **ripple delete**, markers, zoom-to-fit.
- Track headers — rename, mute, solo, lock, per-track volume, reorder, delete.
- Per-clip **transform** (scale, opacity, rotation, x/y), **speed** (0.25–4×), and color-grade **filters**.
- **Transitions** — fade, slide (4 dirs), zoom in/out, wipe — per-clip in/out, composited into preview *and* export.
- **Undo/redo** with gesture coalescing (a drag or slider sweep is one step).
- Timeline polish — video **filmstrip thumbnails** and decoded **audio waveforms** on clips.

**Preview & export**
- Canvas preview with real-time playback, synced audio, master volume.
- **Audio mixing** — clip × track × master gain, mute/solo, fade envelopes — identical in preview and export.
- **In-browser MP4 export** (H.264 + AAC) via canvas `captureStream` + Web Audio + `MediaRecorder`.

**Producer / studio**
- Format templates (UGC Reel, Square, Widescreen, Vertical Quote) that set the canvas and drop a starter layout.
- **Captions** → valid `.srt` / `.vtt` export from text-clip timing.
- **Story beats** (hook/problem/proof/product/human/benefit/CTA) → structured **EDL** and **cutdown** JSON export.
- **Creative scorecard** — a real 0–100 score (hook, CTA, length, caption coverage, audio, pacing, aspect) with inline fixes.

**AI assist** (optional, see below)
- Marketing copy (hooks/CTAs/captions/scripts), image generation, and auto-captions.

**Private by default** — projects and media persist in IndexedDB; the only network calls are the optional AI endpoints.

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
| Serverless | Vercel Functions in `/api` (dependency-free) for AI |
| Hosting | Vercel (static SPA + `/api` functions), git-auto-deploy |

There is no backend for the editor itself — it is a pure client-side SPA. The only
server code is the optional AI functions in `/api`.

---

## Project structure

```text
irie-cut/
├── api/                      Vercel serverless functions (AI; dependency-free)
│   ├── ai-copy.ts            marketing copy (Anthropic → gateway → OpenAI)
│   ├── ai-image.ts           image generation (OpenAI gpt-image-1)
│   └── ai-transcribe.ts      audio → timed captions (OpenAI Whisper)
├── apps/
│   ├── web/                  the editor SPA (Vite)
│   │   ├── index.html        SPA entry
│   │   ├── src/
│   │   │   ├── main.tsx              app bootstrap (router + providers)
│   │   │   ├── routes/              file-based routes (landing, projects, editor)
│   │   │   ├── components/editor/   the editor UI (timeline, preview, panels, dialogs)
│   │   │   ├── components/ui/       shadcn/base-ui primitives
│   │   │   ├── stores/             editor-store.ts (single source of truth)
│   │   │   ├── lib/                pure logic (renderer, exporter, audio, filters, …)
│   │   │   ├── hooks/              playback clock, waveform decode
│   │   │   ├── types/editor.ts     domain types
│   │   │   └── styles.css          Tailwind theme
│   │   ├── vercel.json       CLI-deploy config (deploy from apps/web)
│   │   └── vite.config.ts
│   └── api/                  (legacy OpenCut echo worker — unused by the editor)
├── vercel.json               root config: builds apps/web, SPA rewrite, /api functions
└── ARCHITECTURE.md           the code graph (read this to navigate the repo)
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

> AI endpoints (`/api/*`) don't run under plain `vite dev`. Use `vercel dev` from the
> repo root, or test them on the deployed site.

---

## AI assist (optional)

The editor is fully functional without AI. To enable it, set keys in your Vercel
project env. Each feature uses the provider it's best at, and each falls back gracefully.

| Feature | Provider order | Key(s) |
| --- | --- | --- |
| Copy assist | Anthropic (Claude) → AI Gateway → OpenAI | `ANTHROPIC_API_KEY` *(and/or)* `AI_GATEWAY_API_KEY` / `OPENAI_API_KEY` |
| Image generation | OpenAI `gpt-image-1` | `OPENAI_API_KEY` |
| Auto-captions | OpenAI Whisper | `OPENAI_API_KEY` |

Copy assist prefers a direct `ANTHROPIC_API_KEY` (native Messages API, Claude Sonnet 4.6),
because the Vercel AI Gateway free tier gates premium models. With only a gateway key it
uses the gateway; with only an OpenAI key it uses GPT. Set any one and it works.

**Optional overrides:**

```text
AI_ANTHROPIC_MODEL      default claude-sonnet-4-6      (native Anthropic id, hyphens)
AI_TEXT_MODEL           default anthropic/claude-sonnet-4.6   (gateway slug, dots)
AI_OPENAI_TEXT_MODEL    default gpt-4o-mini
AI_BASE_URL             default https://ai-gateway.vercel.sh/v1
AI_IMAGE_MODEL          default gpt-image-1
AI_IMAGE_BASE_URL       default https://api.openai.com/v1
AI_TRANSCRIBE_MODEL     default whisper-1
AI_TRANSCRIBE_BASE_URL  default https://api.openai.com/v1
```

Env changes apply to **new** deployments — redeploy after setting keys.

---

## Deployment

The web app is a static SPA built from `apps/web`. The **root `vercel.json`** wires:
- `installCommand` / `buildCommand` that build `apps/web`
- `outputDirectory` → `apps/web/dist`
- a SPA rewrite that sends client routes to `index.html` **but excludes `/api`**
- `/api/*` serverless functions (auto-detected at the repo root)

The GitHub repo is connected to the Vercel project, so **pushing to `main` auto-deploys**.
(`apps/web/vercel.json` exists for one-off `cd apps/web && vercel --prod` CLI deploys.)

---

## License

[MIT](LICENSE)
