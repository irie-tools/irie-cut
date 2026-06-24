# Irie Cut — Video Studio → Irie Cut Handoff (design)

_Spec date: 2026-06-24._

## Why

Corey runs two complementary apps (see `BEAT-CUT-SPEC.md` and the two-lane model): **Irie Video
Studio** generates cinematic clips (Higgsfield image→video, b-roll) and HeyGen talking-heads;
**Irie Cut** is the client-side cutter/finisher. The beat-cut engine is already media-agnostic and
the manual path (drop clips in → select → "Cut to beat") is verified. This adds the **one-click
handoff**: a "Send to Irie Cut" button in Video Studio bundles selected clips (+ optional song) into
one file that opens in Irie Cut as a **beat-cut project**, mirroring the existing "Import from Pam".

**Optional by construction:** nothing auto-runs; Irie Cut never depends on Video Studio. This is one
more import button you can ignore. Irie Cut still generates nothing.

## Decisions (from brainstorm)

- **Separate "Import from Video Studio" button** (next to "Import from Pam") — honors Corey's
  two-lane mental model (Pam = music, Studio = brand). Both buttons open the same importer.
- **One shared bundle envelope** (`iriePromo: 1`) extended with an optional `clips[]` (videos). Pam
  bundles fill `cover`/`covers`; Studio bundles fill `clips`. Same importer, one tested path.
- **Song optional.** With a song → clips cut to its beat. Without → clips lay end-to-end as a clean
  sequence (never an error).
- **Tradeoff accepted:** media rides inside the file as data-URLs (no server, no zip, like Pam).
  Sized for a handful of short cinematic clips, not long-form.

## Bundle schema (shared envelope, extended)

`pam-import.ts`'s `PamBundle` is renamed **`PromoBundle`** and extended. New/changed fields only:

```ts
export interface PromoBundle {
  iriePromo: 1
  source?: 'pam' | 'studio'   // provenance hint; if absent, inferred (clips-only ⇒ 'studio')
  title?: string
  artist?: string
  durationSec?: number        // now OPTIONAL
  audio?: string              // data URL — now OPTIONAL (music bed)
  cover?: string              // data URL — now OPTIONAL (Pam canonical cover/poster)
  covers?: string[]           // image variations (Pam)
  clips?: string[]            // NEW — video clips as data URLs (Video Studio)
  lyrics?: string
  lines?: { start: number; end: number; text: string }[]
  campaign?: NonNullable<Project['promo']>['campaign']
  stems?: Record<string, string> | null
}
```

**Validation relaxed:** valid if `iriePromo === 1` **and** at least one visual source is present
(`cover || covers?.length || clips?.length`). `audio` optional. (Today's check that rejects a
missing `cover`/`audio` is replaced by this.)

## Importer changes (`lib/pam-import.ts` → `buildPromoProject`)

1. **Assemble a unified source pool** (order: images, then videos):
   - images: `covers?.length ? covers : (cover ? [cover] : [])` → `BeatCutSource{type:'image'}`,
     each imported as an image `MediaAsset`.
   - videos: `clips ?? []` → each imported as a video `MediaAsset`; **probe each for duration**
     (and width/height) → `BeatCutSource{type:'video', sourceDuration}`.
2. **Duration:** if `audio` present → audio probe (or `durationSec`); else → **sum of video source
   durations** (fallback `DEFAULT_STILL_DURATION` per image when no videos), min 0.5.
3. **Layout:**
   - `sources.length === 1 && image` → existing single-cover **Ken-Burns hero** (unchanged).
   - `audio` present → `getBeats(audio)` → `planBeatCut(songDuration=duration, sourceCount, k:2)`
     → `clipsFromSegments` (handles image+video; video gets no Ken-Burns).
   - **no `audio`** → `sequentialClips(sources, stillDuration)` — lay each source end-to-end at its
     natural length (videos: `sourceDuration`; images: `stillDuration` ≈ 3s). New pure helper.
4. **Audio/captions:** audio clip + caption clips only when those fields exist (Studio bundles
   typically have neither). Don't create an audio track with no media.
5. **Provenance:** `promo.source = b.source ?? (clips-only ? 'studio' : 'pam')`. Captions/campaign
   ride along when present.

## New pure helper (`lib/beat-cut.ts`)

```ts
sequentialClips(args: {
  sources: BeatCutSource[]
  trackId: string
  makeId: () => string
  stillDuration?: number   // default 3
}): Clip[]
```
Lays sources end-to-end: video → `fit:'cover'`, `duration = trimEnd = sourceDuration`; image →
`fit:'cover'` + `kenBurnsKeyframes(stillDuration, i)`, `duration = stillDuration`. Pure + unit-tested.

## Data model

`Project.promo.source`: `'pam'` → `'pam' | 'studio'` (`types/editor.ts`). No other schema change.

## UI (`routes/projects.tsx`)

- Rename `handlePamImport` → `handlePromoImport` (same body — both bundles go through
  `buildPromoProject`). Keep one hidden file input + ref.
- Two buttons both triggering it: existing **"Import from Pam"** (Music icon) and a new
  **"Import from Video Studio"** (Film/Clapperboard icon). Functionally identical; labeled per lane.

## Video Studio side (follow-up — lives in the Video Studio repo, NOT built here)

A **"Send to Irie Cut"** action that writes `<Title>.iriepromo.json`:
`{ iriePromo:1, source:'studio', title, clips:[dataURL…], audio?:dataURL, campaign? }` — selected
library clips (+ optional Pam song) as data-URLs. Mirrors Pam's `packageForIrieCut`. Spec'd here so
the contract is fixed; the writer is a Video Studio-repo task.

## Testing

- **Unit** (`beat-cut.test.ts`): `sequentialClips` — end-to-end starts, video uses sourceDuration &
  no keyframes, image uses stillDuration + Ken-Burns, mixed order.
- **Browser** (Playwright, per repo convention): (a) Studio bundle = 2 video clips + a song → import
  → beat-cut video sequence cycling the clips on the beats (already proven the mechanism manually).
  (b) No-song bundle = 2 clips → import → clean sequential layout, natural durations. (c) Regression:
  an existing Pam multi-cover bundle still imports identically.
- `tsc --noEmit` + `vite build` each slice.

## Build order (small, separately-committed slices)

1. `sequentialClips` in `lib/beat-cut.ts` + unit tests.
2. `PromoBundle` rename + extended fields + relaxed validation + mixed-source assembly + beat/
   sequential layout in `pam-import.ts`; `promo.source` adds `'studio'`. Browser-verify.
3. `projects.tsx`: rename handler + "Import from Video Studio" button.
4. Docs: `PROMO-PIPELINE.md` (Tier 3 handoff note) + this spec.

## Not in this build (deliberately)

- **No generation in Irie Cut.** No Higgsfield/HeyGen calls.
- **No Video Studio writer** (separate repo; contract fixed above).
- **No long-form / streaming pipe.** Data-URL bundles target a handful of short clips.
- **No HeyGen talking-head assembly** — this handoff is the cinematic-clips → beat-cut lane only.
