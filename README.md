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
serverless functions in `/api` that call an OpenAI-compatible endpoint. The editor
works fully without them; to enable, set these in your Vercel project env:

```text
AI_GATEWAY_API_KEY   required — a Vercel AI Gateway key (or AI_API_KEY / OPENAI_API_KEY)
AI_BASE_URL          optional — default https://ai-gateway.vercel.sh/v1
AI_TEXT_MODEL        optional — default openai/gpt-4o-mini
AI_IMAGE_MODEL       optional — default openai/gpt-image-1
AI_TRANSCRIBE_MODEL  optional — default whisper-1
```

If your gateway doesn't expose images/transcription, point `AI_BASE_URL` at a
provider that does. AI runs on the deployed site (or via `vercel dev`), not plain `vite dev`.

## Deployment

The web app is a static SPA built from `apps/web`; the root `vercel.json` wires the
build command, output directory, SPA rewrite (excluding `/api`), and `/api` serverless
functions. Pushing to `main` auto-deploys.

## License

[MIT](LICENSE)
