# Irie Cut — Editor Roadmap & Handoff

_Last updated: 2026-06-24. This is the working plan for turning Irie Cut into a best-in-class
2026 in-browser video editor. A fresh chat/agent should read this + [AGENTS.md](AGENTS.md) +
[ARCHITECTURE.md](ARCHITECTURE.md) before starting._

## North Star

**Be the best in-browser video editor of 2026 — Premiere/CapCut-grade — and stay focused.**
Irie Cut is an *editor*, not an all-in-one media hub. The previous "Media Studio" failed because
it tried to *contain* an entire ecosystem and shipped placeholders instead of real features. The
lesson: **depth over breadth, real over promised.** Editing / compositing / motion / audio / text /
export are the mission. CRM, scheduling, storefronts, analytics, etc. stay in their own Irie apps;
any "hub" behavior is thin integration, deferred to the end (Phase 7) and optional.

Target use cases: advertising, marketing, talking-head, promotional, and home videos — "all the
bells and whistles" a creator expects from modern editors.

### Non-negotiable principles (carry these into every phase)
1. **Real, verified features only.** No fake UI, no placeholder data. Verify in the browser before
   "done" (Playwright loop: run dev server, drive the real UI, screenshot; for export/render check
   the actual output file). Type-check + build each slice.
2. **Shared seams stay shared.** `lib/renderer.ts` and `lib/audio.ts` are used by BOTH the live
   preview and the exporter. Any new pixel/audio behavior goes there so preview == export.
3. **All edits go through `mutate()`** in the store (undo/redo + persistence). Coalesce high-freq edits.
4. **Client-only core.** The editor must work with zero network. AI (`/api`) is the only network call,
   optional, dependency-free.
5. **Ship in small slices**, commit each, push (auto-deploys to https://irie-cut.vercel.app).

---

## Current state (already built & real)

Editor core (projects, media import, multi-track timeline, canvas preview, real MP4 export),
transitions, audio mixing (track gain/mute/solo/master/fades), real creative scorecard, deep
timeline (snapping, per-clip transform + speed, ripple delete, markers, track headers, clip
thumbnails + audio waveforms), undo/redo, AI (copy via Claude, image via gpt-image-1, captions via
Whisper), and a pro-neutral visual pass (cool charcoal + cyan, logo, surface separation, empty
states). Full per-file map in [ARCHITECTURE.md](ARCHITECTURE.md).

Known gaps / candidates already noted: animated hover-scrub thumbnails; drag-to-retime markers;
easing curves; faster export.

---

## Phase 1 — Motion & Keyframes  ✅ BUILT & VERIFIED (2026-06-24)

**Status:** shipped in 5 verified slices (data+lib+renderer → store → panel UX → timeline
markers → verify). Linear-interp keyframes on `x/y/scale/rotation/opacity` animate in the shared
renderer (so preview == export), are undo-able, and persist. Verified in-browser against the real
`drawFrame`: scale 1.0→1.25 ramps then clamps (500→562→624px square), opacity 0→1 fades
(luma 0→128→255), live preview animates, panel diamonds + slider-write-at-playhead + timeline
markers + marker-jump + undo/redo all work.

> Note on export: the realtime `MediaRecorder`/`captureStream` exporter renders the correct
> animated frames (same `drawFrame`), but in headless capture it drops early frames / yields a
> low-frame-count file. This is the pre-existing realtime-export fidelity limit already slated for
> **Phase 5 WebCodecs** — not a keyframe issue. Next motion slices: easing curves, drag-to-retime
> markers on the clip.

<details><summary>Original design (kept for reference)</summary>

**Goal:** animate `x, y, scale, rotation, opacity` per clip over time (Ken Burns, slide-in, pulse,
fade). Linear interpolation v1 (easing curves later). Renders in preview AND export; undo-able.
UX = "Panel toggles + clip markers" (the agreed design).

**Data model** (`types/editor.ts`): add to `Clip`
```ts
keyframes?: Partial<Record<'x' | 'y' | 'scale' | 'rotation' | 'opacity',
  { t: number; value: number }[]>>  // t = seconds relative to clip start, time-sorted
```
A property with no keyframes uses the static `clip.transform` value; with keyframes the animation overrides it.

**New `lib/keyframes.ts`:**
- `keyframeValueAt(keys, t, fallback): number` — linear interp between surrounding keyframes; clamp past ends; `fallback` (static transform value/default) when empty.
- `transformAt(clip, clipLocalTime): {x,y,scale,rotation,opacity}` — per-property resolve.
- `keyframeTimes(clip): number[]` — deduped union of all keyframe times (for markers).

**Renderer** (`lib/renderer.ts`): `applyClipTransform` computes the effective transform via
`transformAt(clip, time - clip.start)` instead of reading the static transform directly. (Exporter
already shares this — nothing else to change for export.)

**Store** (`stores/editor-store.ts`): `setKeyframe(clipId, prop, t, value)` (add/replace at ~t,
keep sorted), `removeKeyframe(clipId, prop, t)`, `clearKeyframes(clipId, prop)` — all via `mutate()`;
slider drags pass a coalesce key (e.g. `kf:scale:<clipId>`).

**Properties panel** (`TransformControls`): each transform row gets a ◆ diamond toggle.
- No keyframes → click adds first keyframe at playhead (clip-local), turns animation on.
- Keyframed → diamond filled when playhead is ON a keyframe (±~1 frame), hollow otherwise; click
  adds/removes at playhead. Dragging the slider writes the value at the current playhead. Slider
  displays the interpolated value while scrubbing. Disable the diamond when the playhead is outside
  the clip span. Provide a way to clear all (revert to static).

**Timeline** (`ClipView`): render small diamond markers along the clip bottom at `keyframeTimes`,
positioned `(t / duration) * width`; click → set playhead to `clip.start + t`. (Drag-to-retime is a
later slice.)

**Verify:** scale 1.0→1.5 across a clip → preview grows, exported mid-frame ≈1.25×; opacity 0→1 →
real fade in export; markers show + jump the playhead; undo/redo steps cleanly.

</details>

---

## Phase 2 — Effects & Compositing  (next, in this order)

1. **Color adjustments (easy win first):** per-clip brightness/contrast/saturation/temperature/
   hue via `ctx.filter` (already proven — filters render in preview+export). Add an "Adjust" section
   in properties with sliders → store on `clip.adjust`. Compose with existing filter presets.
2. **Blend modes:** per-clip `ctx.globalCompositeOperation` (screen, multiply, overlay, add…).
3. **Masks:** rectangle / ellipse / linear-gradient reveal per clip using `ctx.clip()` (we already
   clip for wipes) + an invert toggle. Mask params keyframeable later.
4. **Chroma key (green screen)** and **AI background removal** — the big architectural step. Canvas2D
   `drawImage` can't do per-pixel keying, so introduce a **GPU/processing pass**:
   - Option A: WebGL shader pass for chroma key + advanced color (curves/LUTs) — a clip is rendered
     to a texture, processed, then composited. Keep canvas2D as fallback.
   - Option B (bg removal): MediaPipe Selfie Segmentation (client-side, real) or a hosted segmentation
     API behind `/api`.
   - Whatever lands, it must serve the **shared renderer** so preview == export. This is the single
     biggest infra rock in the effects cluster — scope it on its own.

---

## Phase 3 — Text, Stickers & Overlays

- **Rich text:** stroke/outline, drop shadow, letter-spacing, line-height, background styles, a real
  **font picker** (bundle a curated set or load Google Fonts), and **animated text presets**
  (typewriter, pop, slide, fade) — built on Phase 1 keyframes.
- **Stickers / shapes layer:** rect, ellipse, arrow/line, emoji, and imported PNG stickers as
  clips with transform + keyframes. Add a "Shapes/Stickers" tab in the media panel.
- **Sticker/emoji library** (curated, bundled or fetched).

---

## Phase 4 — Audio Depth

Audio keyframes (volume automation drawn over the waveform), fade-handles on clips, beat detection
+ snap-to-beat, Web Audio effects (EQ, compressor, reverb), auto-ducking (sidechain voice over
music), basic noise reduction, and a built-in music/SFX library (bundled or via `/api`).

---

## Phase 5 — Pro Workflow & Export Engine

- **WebCodecs export (high priority infra):** replace the realtime `MediaRecorder` exporter with
  `VideoEncoder`/`AudioEncoder` + an mp4 muxer (e.g. `mp4-muxer`) for **frame-accurate, faster,
  higher-quality** export and resolution/bitrate/format presets per platform. Biggest quality+speed
  unlock; can be pulled earlier if export fidelity matters.
- **Editing ergonomics:** multi-select, copy/paste/duplicate across tracks, group, nudge, ripple/
  roll/slip/slide trims, optional magnetic timeline.
- **Project portability:** export/import a project (JSON + media bundle), autosave/version history,
  full edit templates.
- **Performance:** OffscreenCanvas + worker rendering, decoded-frame cache, timeline virtualization
  for large projects.
- **Discoverability:** keyboard-shortcut cheat sheet + command palette.

---

## Phase 6 — Modern / 2026 AI & GPU

Auto-reframe (one aspect → another with subject tracking), text-based editing (edit the transcript →
trims the video), script-to-video, AI voice cleanup, AI music, motion tracking, stabilization,
LUTs, WebGPU effect graph, expanded transitions (glitch/3D), speed-ramp curves.

---

## Phase 7 — Thin Ecosystem Hooks (deferred, optional)

Only after the editor is excellent: import-from / publish-to bridges to other Irie platforms, a
shared brand kit, and handoff/publish destinations. Keep these as **integration points**, never as
features Irie Cut has to own.

---

## Suggested execution order for the next session
1. **Phase 1 keyframes** (designed above — build it first, in slices: data+lib+renderer → store →
   panel UX → clip markers → verify export).
2. **Phase 2.1 color adjustments** (quick, high-impact `ctx.filter` win), then blend modes + masks.
3. **Phase 5 WebCodecs export** if you want pro export quality/speed sooner (it's infra that
   everything benefits from) — otherwise continue effects.
4. **Phase 2.4 chroma key / bg removal** (scope the GPU pass on its own).
5. **Phase 3 text & stickers**, then **Phase 4 audio**, then **Phase 6 AI/GPU**.

## Big rocks to plan deliberately (don't sneak these in)
- GPU/WebGL(WebGPU) compositing path for chroma key, curves, LUTs (must serve the shared renderer).
- WebCodecs export engine (replaces realtime MediaRecorder).
- These two are the foundation that unlocks most "2026" capabilities — give each its own design pass.
