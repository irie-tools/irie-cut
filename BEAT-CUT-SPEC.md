# Irie Cut — Multi-image Beat-Cut Music Video (design)

_Spec date: 2026-06-24._

## Why

Corey is a lifelong musician from the music-video era — visual + music has presence.
Pam (his music studio) dropped video because the only option was looping a ~15s clip over a
full song, which reads as **slop**. The principle underneath that choice isn't "no AI" — it's
**no unnatural repetition; every visual beat must feel intentional.** Irie Cut's beat-cutter is
the anti-slop machine: it arranges N pieces of visual material *to the music*, so nothing has to
loop.

This feature lets **Pam send N cover variations** and **Irie Cut cut them to the beat**. The
engine is built **media-agnostic** (it cuts photos or video clips identically) so the *same* tool
can later cut Higgsfield motion clips — made in **Irie Video Studio** and handed off, **never
generated inside Irie Cut** — as *accents* sprinkled among the stills. Video is **not** part of
this build; the engine is just designed not to preclude it.

## Lanes & constraints (do not blur)

- **Irie Cut generates nothing.** Client-side only, zero credits. Generation lives in Irie Video
  Studio (HeyGen talking-head, Higgsfield cinematic / image→video). This feature is the **cutter/
  finisher**, the back half of the pipeline.
- **Music-promo (Pam) lane:** stills now. The "no AI video" rule is honored — video is a *later,
  opt-in accent*, not this build.
- **Reuse existing seams:** `getBeats` (beat-detect), `keyframes` (Ken Burns), `mutate()` + undo,
  `project-io`, `addCaptions`. Mostly wiring, little net-new.

## Decisions (from the brainstorm)

- **Cadence:** cut every **K** beats, cycling through the sources; default **K = 2**, adjustable.
- **Transition:** **hard cut** on the beat; **Ken Burns per still** (drift direction alternates by
  index so cycled repeats don't look mechanical). Video sources get *no* added motion (they already
  move).
- **Scope:** **both** — Pam import (N covers) *and* a standalone store action on selected clips.
- **Engine is media-agnostic** (image *or* video sources) from day one; **stills are the only
  sources wired now**.

## Architecture

### New — `lib/beat-cut.ts` (pure, deterministic, unit-tested)

```ts
planBeatCut({ beats, songDuration, sourceCount, k=2, startAt=0 }) → Segment[]
//   Segment = { sourceIndex: number, start: number, duration: number }
```

- Cut points = `beats[0], beats[k], beats[2k]…` that fall within `(startAt, songDuration)`.
- Segment *i* spans `cut[i] → cut[i+1]` (last segment → `songDuration`); `sourceIndex = i % sourceCount`.
- **Min-segment guard** (~0.2s): merge cut points that would produce too-tight segments.
- **No-beats fallback:** even split of `songDuration` across `sourceCount`.
- Helper `kenBurnsKeyframes(duration, index) → { scale, x }`: scale `1 → ~1.08`, slight x drift,
  direction alternates by `index`.

Pure + deterministic ⇒ tested like `beat-detect.test.ts`.

### Edit — `lib/pam-import.ts`

- Extend the bundle contract: `PamBundle.covers?: string[]` (data-URLs). Backward-compatible.
  `images = (covers && covers.length) ? covers : [cover]`. `cover` stays required and remains the
  **canonical / poster** image.
- Import **every** image as a `MediaAsset`.
- If `images.length > 1`: `getBeats(audio)` → `planBeatCut(sourceCount = images.length)` → emit
  image clips (cycled `mediaId`s) on the video track, each `fit:'cover'` + `kenBurnsKeyframes`.
- If single image: **current single-cover Ken-Burns hero — unchanged.**
- Audio + captions paths unchanged.

### Edit — `stores/editor-store.ts` — `beatCutToBeats(clipIds, k=2): Promise<number>`

- **Sources** = `clipIds` resolved to clips of type `image` or `video`, in timeline order.
- Find the song audio clip → `getBeats` → map source-time onsets into timeline time via the song
  clip's `start`/`trim` (same mapping as `detectBeats`).
- `planBeatCut(sourceCount = sources.length)`. Place the generated sequence on the **first source's
  track**, replacing the selected source clips: each segment → a new clip referencing
  `sources[sourceIndex].mediaId`, positioned per the plan.
  - Image source → `fit:'cover'` + `kenBurnsKeyframes`.
  - Video source → set `trimStart/trimEnd` to cover the segment (clamp to the source's available
    duration); no added motion.
- One `mutate()` ⇒ one undo step. Returns the segment count.
- Guard: needs ≥1 source **and** a song with detectable beats, else returns 0 (no-op).

### UI

- **Command palette:** "Cut images to the beat" → `beatCutToBeats(selectedClipIds, 2)`.
- **Properties panel:** when ≥2 image/video clips are selected, a **"Beat-cut"** section — a K
  control (1 / 2 / 4) + a "Cut to beat" button. Mirrors the existing "Pulse to beat" block.
  Re-running with a different K re-lays.
- **Pam import:** automatic; no new UI.

### Data model

No new clip fields — reuses `keyframes` + `fit:'cover'`. The only type addition is
`PamBundle.covers?`.

## Testing

- **Unit** `beat-cut.test.ts`: cycling indices, last-segment-reaches-`songDuration`, K = 1/2/4,
  min-duration merge, no-beats even split, `startAt` offset.
- **Browser** (Playwright loop, per repo convention): multi-cover bundle → N clips swap at the beat
  markers; export a few seconds and confirm frames change at the cuts. Standalone: select images →
  action → clips re-laid at beats; one undo reverts cleanly.
- `bunx tsc --noEmit` + `bun run build` each slice.

## Build order (small, separately-committed slices)

1. `lib/beat-cut.ts` + tests (pure engine).
2. Pam import multi-cover (the headline path) — verify with a sample multi-cover bundle.
3. Standalone `beatCutToBeats` + command-palette entry.
4. Properties-panel "Beat-cut" UI (K control).
5. Docs: mark the feature in `PROMO-PIPELINE.md`.

## Not in this build (deliberately — anti-bloat)

- **No generation in Irie Cut.** No Higgsfield/HeyGen calls; it stays a free, client-side cutter.
- **No Studio → Irie Cut clip handoff yet.** The engine is ready for it; wire it later when you
  actually want to route generated clips in.
- **No crossfade option** (hard cut only) and **no per-segment manual override UI** in v1.
