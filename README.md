# Irie Cut

**A free, open video editor that runs entirely in your browser.**

Import clips, cut and layer them on a multi-track timeline, add titles, and export an MP4 — with no account, no watermark, and nothing uploaded to a server. Your media is stored locally and every frame is rendered on-device.

Irie Cut began as a rebuild on top of the [OpenCut](https://github.com/opencut-app/opencut) rewrite scaffold (MIT) and is being developed independently.

## Features

- **Multi-track timeline** — stack video, images, audio and text; drag to move, grab an edge to trim, split at the playhead, duplicate, delete.
- **Titles & captions** — styled text anywhere on the frame (font size, color, alignment, position).
- **Canvas preview** — real-time playback that composites video, images and text with mixed audio.
- **In-browser export** — render the timeline to a downloadable MP4 (H.264 + AAC) via the canvas + Web Audio + MediaRecorder.
- **Private by default** — projects and media live in IndexedDB; nothing leaves the device.

## Tech

- React 19 + TanStack Router (file-based) as a static Vite SPA
- Tailwind v4 + base-ui / shadcn components
- zustand for editor state, IndexedDB for persistence
- Deploys as static assets (Vercel-ready)

## Development

Uses [proto](https://moonrepo.dev/proto) to pin `bun` + `moon`:

```sh
proto use      # installs bun + moon from .prototools
cd apps/web
bun install
bun run dev    # http://localhost:5173
```

Build the static site:

```sh
cd apps/web
bun run build  # outputs apps/web/dist
```

## AI assist (optional)

Marketing-copy, auto-captions, and image generation run through dependency-free
serverless functions in `/api`. The editor works fully without them. Each feature
picks the provider it's best at:

| Feature | Provider (default) | Key |
| --- | --- | --- |
| Copy assist | Vercel AI Gateway → Claude | `AI_GATEWAY_API_KEY` |
| Image generation | OpenAI `gpt-image-1` | `OPENAI_API_KEY` |
| Auto-captions | OpenAI Whisper | `OPENAI_API_KEY` |

Set those two keys in your Vercel project env to enable everything. Optional overrides:

```text
AI_TEXT_MODEL          default anthropic/claude-sonnet-4.6   (gateway slug; dots, not hyphens)
AI_BASE_URL            default https://ai-gateway.vercel.sh/v1
AI_IMAGE_MODEL         default gpt-image-1
AI_IMAGE_BASE_URL      default https://api.openai.com/v1
AI_TRANSCRIBE_MODEL    default whisper-1
AI_TRANSCRIBE_BASE_URL default https://api.openai.com/v1
```

AI runs on the deployed site (or via `vercel dev`), not plain `vite dev`.

## Deployment

The web app is a static SPA built from `apps/web`; the root `vercel.json` wires the
build command, output directory, SPA rewrite (excluding `/api`), and `/api` serverless
functions. Pushing to `main` auto-deploys.

## License

[MIT](LICENSE)
