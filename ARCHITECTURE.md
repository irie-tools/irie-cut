# Irie Cut — Code Graph & Architecture

A navigation map for humans and AI agents. It shows **how the pieces connect**, the
**core data flows**, and **what every file does**. If you're about to change something,
find it here first.

- **Stack:** React 19 · TanStack Router (file-based) · zustand · Tailwind v4 · Vite 8 · Canvas 2D · Web Audio · Vercel Functions
- **Shape:** a pure client-side SPA (`apps/web`) + optional dependency-free AI functions (`/api`). No backend for the editor.
- **One rule to remember:** the **canvas renderer (`lib/renderer.ts`) is shared by the live preview and the exporter**, so anything you draw shows up in both. Same for **audio gain (`lib/audio.ts`)**.

---

## Module graph (who depends on whom)

```mermaid
graph TD
  subgraph Routes
    R1[routes/index.tsx<br/>landing]
    R2[routes/projects.tsx<br/>project list]
    R3[routes/editor.$projectId.tsx]
  end

  R3 --> ED[components/editor/editor.tsx<br/>shell + shortcuts]
  ED --> MP[media-panel.tsx]
  ED --> PV[preview-panel.tsx]
  ED --> PR[properties-panel.tsx]
  ED --> TL[timeline.tsx]
  ED --> EXP[export-dialog.tsx]
  ED --> SC[score-dialog.tsx]
  MP --> AIP[ai-panel.tsx]

  subgraph Store
    ST[stores/editor-store.ts<br/>single source of truth + undo/redo]
  end
  MP --> ST
  PV --> ST
  PR --> ST
  TL --> ST
  EXP --> ST
  ED --> ST

  ST --> STG[lib/storage.ts<br/>IndexedDB]
  ST --> MED[lib/media.ts<br/>probe + thumbnails]
  ST --> TPL[lib/templates.ts]

  PV --> RND[lib/renderer.ts<br/>frame compositor]
  PV --> AUD[lib/audio.ts<br/>gain/mix math]
  EXP --> EXR[lib/exporter.ts]
  EXR --> RND
  EXR --> AUD
  RND --> FLT[lib/filters.ts]
  RND --> TRN[lib/transitions.ts]

  EXP --> CAP[lib/captions.ts<br/>SRT/VTT]
  EXP --> BTS[lib/beats.ts<br/>EDL/cutdown]
  SC --> SCR[lib/score.ts]
  TL --> WFH[hooks/use-waveform.ts] --> WAV[lib/waveform.ts]
  PV --> PBK[hooks/use-playback.ts]

  AIP --> AIC[lib/ai.ts] --> API{{/api/ai-*}}
  API --> PROV[(Anthropic / OpenAI / AI Gateway)]
```

---

## Core data flows

### 1) Rendering a frame (preview)
```mermaid
sequenceDiagram
  participant Store as editor-store (project, currentTime)
  participant PV as preview-panel (rAF loop)
  participant Sync as syncMedia (hidden video/audio els)
  participant RND as renderer.drawFrame
  participant Canvas
  PV->>Store: read project + currentTime + isPlaying
  PV->>Sync: seek/play each clip's media element; set el.volume = effectiveGain()
  PV->>RND: drawFrame(ctx, project, time, sources)
  RND->>Canvas: bg → video/image (transform+transition+filter) → text on top
```
`hooks/use-playback.ts` advances `currentTime` in real time while playing.

### 2) Exporting an MP4
```mermaid
sequenceDiagram
  participant EXP as exporter.exportProject
  participant Canvas as offscreen canvas
  participant WA as Web Audio graph (per-clip gain → dest)
  participant MR as MediaRecorder
  EXP->>WA: build MediaElementSource→Gain per audio/video clip
  loop each frame (real time)
    EXP->>EXP: syncExport(t): seek els, set gain = effectiveGain()
    EXP->>Canvas: drawFrame(...) (same renderer as preview)
  end
  Canvas-->>MR: captureStream() video track
  WA-->>MR: dest.stream audio track
  MR-->>EXP: chunks → Blob (mp4/webm) → download
```

### 3) State, persistence & undo/redo
- Every edit goes through `mutate()` in the store: it pushes the previous project onto `past`, applies the change, clears `future`, and **debounce-saves** to IndexedDB.
- A `coalesceKey` collapses rapid mutations (drag/slider/typing) into a single undo step.
- `undo()` / `redo()` swap snapshots between `past` ⇄ `project` ⇄ `future`.

### 4) AI
- `ai-panel.tsx` → `lib/ai.ts` → `POST /api/ai-*` → provider → result mapped back into the store
  (`addTextClip`, `importFiles`+`addClipFromMedia`, or `addCaptions`).
- Functions are dependency-free (`fetch` only) and fall back across providers; they return a friendly 503 when unconfigured.

---

## Annotated file map

### Root
| Path | Role |
| --- | --- |
| `vercel.json` | **Deploy brain.** Builds `apps/web`, sets output dir, SPA rewrite (excludes `/api`), enables `/api` functions. Used by git auto-deploy. |
| `apps/web/vercel.json` | Config for one-off CLI deploys from inside `apps/web`. |
| `bunfig.toml`, `.prototools`, `.moon/` | Toolchain pinning (bun/moon via proto). |

### `/api` — serverless AI (dependency-free, `fetch` only)
| File | Role |
| --- | --- |
| `ai-copy.ts` | Marketing copy. Tries **Anthropic direct → AI Gateway → OpenAI**; returns `{ variants, model }`. |
| `ai-image.ts` | Image generation via OpenAI `gpt-image-1`; returns a `{ dataUrl }`. |
| `ai-transcribe.ts` | Audio (base64) → OpenAI Whisper → `{ cues: [{start,end,text}] }`. |

### `apps/web/src/types`
| File | Role |
| --- | --- |
| `editor.ts` | **Domain types** — `Project` (incl. optional workflow intent), `Track`, `Clip` (incl. `transform`, `speed`, `filter`, `quality`, `role`, `transitionIn/Out`), `TextProperties`, defaults. Start here to understand the data model. |

### `apps/web/src/stores`
| File | Role |
| --- | --- |
| `editor-store.ts` | **The single source of truth.** Holds the loaded project, media, selection, playhead, zoom, undo/redo history. All mutations + persistence live here (`mutate`, `undo`, `addClipFromMedia`, `splitAtPlayhead`, `updateTrack`, `addCaptions`, `applyTemplate`, …). Exports `createProject` and `projectDuration`. |

### `apps/web/src/lib` — pure logic (no React)
| File | Role |
| --- | --- |
| `renderer.ts` | **Canvas compositor.** `drawFrame()` paints one frame: background → video/image (with transform, transition, filter) → text. Shared by preview + export. |
| `exporter.ts` | Real-time MP4 export: offscreen canvas + `captureStream` + Web Audio mixing + `MediaRecorder`. |
| `audio.ts` | Mixing math: `effectiveGain()` (clip × track × master × mute/solo × fade), `anySolo()`. Shared by preview + export. |
| `transitions.ts` | Per-clip in/out transitions; `transitionModifier()` returns alpha/translate/scale/clip. |
| `filters.ts` | Color-grade presets (CSS `filter` strings) + `filterCss()`. |
| `quality.ts` | Lightweight per-clip enhance/denoise helpers composed into the shared canvas filter chain. |
| `storage.ts` | IndexedDB wrapper (projects, media metadata, media blobs). |
| `media.ts` | Probe uploaded files (duration/dimensions), generate thumbnails, time formatting. |
| `waveform.ts` | Decode audio → cached normalized peak buckets. |
| `captions.ts` | Build `.srt` / `.vtt` from text clips. |
| `caption-words.ts` | Attach Whisper word timings to caption cues as clip-local karaoke words. |
| `caption-styles.ts` | Reusable caption track style presets. |
| `beats.ts` | Story-beat roles + `buildEdl()` / `buildCutdown()` / `beatSummary()`. |
| `score.ts` | `scoreProject()` — creative score + deterministic export-readiness checks, including workflow-aware YouTube music-video checks. |
| `templates.ts` | Format templates (ratio + starter layout specs, plus optional workflow/project defaults). |
| `pam-import.ts` | Pam/Video Studio handoff importers: `iriePromo: 1` single promo bundles and `iriePromo: 2` Pam YouTube Album Release folders. |
| `ai.ts` | Client wrappers for the `/api/ai-*` endpoints. |
| `utils.ts` | `cn()` class helper. |

### `apps/web/src/hooks`
| File | Role |
| --- | --- |
| `use-playback.ts` | rAF clock that advances `currentTime` while playing; stops at the end. |
| `use-waveform.ts` | Loads a clip's audio blob and returns cached waveform peaks. |
| `use-mobile.ts` | Viewport helper (from scaffold). |

### `apps/web/src/components/editor`
| File | Role |
| --- | --- |
| `editor.tsx` | **Shell.** Loads the project, mounts playback, global keyboard shortcuts (space, S split, M marker, ⌘Z undo/redo, arrows), lays out the resizable panels, header (undo/redo, score, export). |
| `media-panel.tsx` | Left panel tabs: Media (import + assets), Text, Templates, AI. |
| `ai-panel.tsx` | AI tab UI: copy assist, image gen, auto-captions with optional word timing. |
| `preview-panel.tsx` | Center canvas + transport + master volume; owns the render/sync loop and hidden media elements. |
| `properties-panel.tsx` | Right panel: selected-clip props (timing, role, volume, speed, filter, transform, transitions, text) or project settings. |
| `timeline.tsx` | The timeline: toolbar, ruler + markers, track-header gutter (mute/solo/lock/volume/reorder), clips (drag/trim/snap, filmstrip thumbnails, waveforms, role badges). |
| `export-dialog.tsx` | Export modal: readiness summary, MP4 render, caption (.srt/.vtt), edit-plan (EDL/cutdown), and post-kit downloads. |
| `score-dialog.tsx` | Creative scorecard modal + header score badge. |
| `project-menu.tsx` | Inline-editable project title. |

### `apps/web/src/components/ui`
shadcn / base-ui primitives (button, dialog, slider, select, tabs, …). Generated; rarely edited by hand.

### `apps/web/src/routes`
| File | Role |
| --- | --- |
| `__root.tsx` | Root layout + providers (TooltipProvider, Outlet). |
| `index.tsx` | Marketing landing page. |
| `projects.tsx` | Project list / create / delete (IndexedDB). |
| `editor.$projectId.tsx` | Editor route; wraps `<Editor>` in `ClientOnly`. |
| `routeTree.gen.ts` | **Generated** by the TanStack Router plugin — do not edit. |

---

## Where to add things (extension points)

| You want to… | Touch these |
| --- | --- |
| Add a clip property | `types/editor.ts` (the field) → `editor-store.ts` (mutation) → `properties-panel.tsx` (UI) → `renderer.ts`/`exporter.ts` if it affects pixels/audio |
| Add a visual effect | `filters.ts` or `transitions.ts` → it renders in preview + export automatically (shared renderer) |
| Add a timeline tool | `timeline.tsx` (toolbar/clip interaction) + a store action |
| Add an export/producer artifact | a `lib/*.ts` builder + a button in `export-dialog.tsx` |
| Add an AI capability | a function in `/api` + a wrapper in `lib/ai.ts` + UI in `ai-panel.tsx` |
| Change scoring | `lib/score.ts` (`scoreProject`) |

## Research imports
- `REMOTION-SUPERPOWERS-EXTRACTION.md` records the 2026-06-28 read-only research pass over `/Users/irieagent/Documents/repo-research/remotion-superpowers`.
- `AI-MUSIC-VIDEO-WORKFLOW.md` records the 2026-07-03 extraction from the faceless YouTube music-video markdown set under `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge`.
- `VPS-MIGRATION-ASSESSMENT.md` records the 2026-07-03 research pass for moving Irie Cut from Vercel into the VPS/Cloudflare Media House lane.
- Source boundary: extract workflow patterns only. Do not vendor Remotion, MCP configs, hook scripts, or external-service dependencies into the editor core.
- Implemented pulls: auto-captions preserve Whisper word timings via `caption-words.ts`; `scoreProject()` includes deterministic export-readiness checks that surface in the score dialog and export modal; the YouTube Music Video template marks projects with `workflow.kind = "youtube-music-video"` for workflow-specific checks.

## Invariants worth keeping
- **Preview == export:** route any new pixel/audio behavior through `renderer.ts` / `audio.ts` so both stay in sync.
- **All edits go through `mutate()`** so undo/redo and persistence keep working; pass a `coalesceKey` for high-frequency updates.
- **Client-only:** the editor must run with no network. Keep browser-only APIs out of SSR (editor routes are wrapped in `ClientOnly`) and keep the core free of server calls (AI is the only exception, and it's optional).
- **`/api` functions stay dependency-free** (plain `fetch`) so they need no build step or root `package.json`.
