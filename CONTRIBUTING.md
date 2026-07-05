# Contributing to Irie Cut

Thanks for taking a look. Irie Cut is a free, in-browser video editor — this doc is the
outside-contributor version of the project's internal guides ([AGENTS.md](AGENTS.md),
[ARCHITECTURE.md](ARCHITECTURE.md), [ROADMAP.md](ROADMAP.md)); read those for the deep dive.

## Before you start

1. **Look for an existing issue** on what you want to build, or open one to discuss it first —
   especially for anything bigger than a small fix. Saves everyone rework.
2. Issues labeled [`good first issue`](https://github.com/irie-tools/irie-cut/labels/good%20first%20issue)
   are scoped small and don't require deep familiarity with the codebase.

## Local setup

```sh
cd apps/web
bun install       # or npm install — either works
bun run dev       # http://localhost:5173
```

```sh
bun run build     # static output in apps/web/dist
bun run test      # vitest
bunx tsc --noEmit # typecheck
```

No `.env` needed to run the editor itself — it works with zero network calls. A `.env` is
only required if you're touching the optional `/api` AI functions (see below).

## The rules that keep this project coherent

These aren't style preferences — breaking them causes real bugs (preview and export drifting
apart, undo/redo breaking, SSR crashes):

1. **The renderer and audio math are shared.** `lib/renderer.ts` (canvas) and `lib/audio.ts`
   are used by both the live preview *and* the exporter. Any new pixel or audio behavior goes
   there, not into a fork — otherwise what you see while editing won't match the exported file.
2. **Every project edit goes through `mutate()`** in `stores/editor-store.ts`. That's what keeps
   undo/redo and IndexedDB persistence working. For frequent updates (drags, slider input,
   typing) pass a `coalesceKey` so you don't spam the undo stack.
3. **The editor core must work with zero network.** This is the whole pitch — no accounts, no
   server, runs entirely on-device. The only network calls live in `/api/ai-*.ts`, and they're
   optional: the UI must keep working (gracefully, without those features) if no AI key is set.
4. **`/api` functions stay dependency-free** — plain `fetch`, no SDK imports. There's no root
   `package.json` for them to resolve packages against.
5. Don't hand-edit `apps/web/src/routeTree.gen.ts` — it's generated.

## What "done" looks like

- Ship in **small, separately-committed slices** rather than one large PR touching a dozen
  things — easier to review, easier to bisect if something breaks.
- **Verify it in the browser** before opening a PR: run the dev server and actually click through
  the feature. For anything touching export, captions, or scoring, check the real output file —
  not just that the code compiles.
- `bunx tsc --noEmit` and `bun run build` should both be clean.
- No placeholder or fake data — if a feature isn't real yet, it doesn't ship yet. (This project
  was rebuilt once already to get away from placeholder features; we're keeping that bar.)

## Opening a PR

- Reference the issue it closes.
- Describe what you tested and how, especially for anything visual or export-related — a
  screenshot or short clip helps a lot.
- Small and focused beats large and sprawling.

## Code of conduct

Be respectful, assume good faith, keep feedback about the code, not the person. Maintainers may
close issues or PRs that don't fit the project's direction (see [ROADMAP.md](ROADMAP.md)'s North
Star) — that's a scope decision, not a judgment of the contribution.
