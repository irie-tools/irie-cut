# AGENTS.md — orientation for AI agents

Start here, then read **[ARCHITECTURE.md](ARCHITECTURE.md)** (the code graph: module
diagram, data flows, and a per-file map) and **[ROADMAP.md](ROADMAP.md)** (the plan & handoff:
North Star, what's built, and the phased feature roadmap — Phase 1 Motion & Keyframes is
designed and ready to build first). This file is the 30-second version.

**Mission in one line:** the best in-browser video editor of 2026 (Premiere/CapCut-grade),
focused — NOT an all-in-one media hub. Depth over breadth, real over promised.

## What this is
**Irie Cut** — a free, client-side, in-browser video/media editor + studio. Pure SPA
(`apps/web`, React 19 + Vite + zustand) with optional dependency-free AI functions in `/api`.
No backend for the editor. Deployed on Vercel (git push to `main` auto-deploys).

## Where things live
- Data model: `apps/web/src/types/editor.ts`
- State + all mutations + undo/redo + persistence: `apps/web/src/stores/editor-store.ts`
- Pure logic: `apps/web/src/lib/*` (renderer, exporter, audio, filters, transitions, captions, beats, score, templates, storage, media, waveform, ai)
- UI: `apps/web/src/components/editor/*`
- AI serverless: `/api/ai-*.ts`

## Hard rules (don't break these)
1. **The canvas renderer (`lib/renderer.ts`) and audio math (`lib/audio.ts`) are shared by
   the live preview AND the exporter.** Put any new pixel/audio behavior there so preview and
   export match. Don't fork the logic.
2. **Every project edit goes through `mutate()` in the store** (keeps undo/redo + IndexedDB
   persistence working). For high-frequency updates (drags, sliders, typing) pass a `coalesceKey`.
3. **Client-only.** The editor must work with zero network. Keep browser APIs out of SSR
   (editor routes are wrapped in `ClientOnly`). AI is the only network call and is optional.
4. **`/api` functions stay dependency-free** (plain `fetch`, no imports needed) — there is no
   root `package.json` for them to resolve against.
5. **Don't edit generated files:** `apps/web/src/routeTree.gen.ts`.

## Workflow conventions (what's worked here)
- Build features in **small, verified, separately-committed** slices. Don't batch a dozen
  things into one commit.
- **Verify in the browser** before claiming done (this repo was built with a Playwright loop:
  run the dev server, drive the real UI, screenshot, and for export/caption/score check the
  actual output file/JSON). Type-check (`bunx tsc --noEmit`) and `bun run build` each slice.
- Prefer **real, working** features over breadth. This project was deliberately rebuilt to
  avoid a prior prototype's placeholder/fake features — keep that bar.
- lucide-react v1 icon names: verify a module exists at
  `node_modules/lucide-react/dist/esm/icons/<kebab>.mjs` before importing.
- UI primitives are **base-ui** (not classic Radix): `Button` uses `render=` + `nativeButton={false}`
  for links; `Slider`/`Select` callbacks may pass `value | value[]`.

## Run / build / deploy
```sh
cd apps/web && bun install && bun run dev     # http://localhost:5173
cd apps/web && bun run build                  # static output in apps/web/dist
# deploy: push to main (Vercel auto-deploys). AI runs only on Vercel or `vercel dev`.
```

## Add-a-feature cheat sheet
See the "Where to add things" table in [ARCHITECTURE.md](ARCHITECTURE.md#where-to-add-things-extension-points).
