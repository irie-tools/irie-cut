# Irie Cut — Promo Pipeline Spec (Pam-aware)

_Spec date: 2026-06-24._

> **Build status (2026-06-24):** the pipeline spine is **BUILT & VERIFIED** end-to-end.
> Shipped (Irie Cut): **1.1 Pam import** (song → captioned Ken-Burns 9:16 promo), **1.2 caption
> styling** (4 track presets), **1.3 one-click multi-size export** (verified 1080×1920 + 1080×1080),
> **Tier 2 beat-pulse** (cover punches on detected beats — 10→170 keyframes), **Tier 3 post-kit**
> (caption + hashtags from the Pam campaign + poster). Shipped (Pam repo, additive, not deployed):
> the **Send to Irie Cut** writer (`packageForIrieCut` + route + Studio button) producing the
> `.iriepromo.json`. Verified: sample bundle → promo, multi-size export, post-kit, beat-pulse; 26
> Irie Cut tests + build clean; Pam changes type/lint-clean, zero test regression.
>
> **Update (2026-06-24): 2.1 multi-image beat-cut is BUILT & VERIFIED.** A Pam bundle may now carry
> `covers[]` (N cover variations); >1 cover assembles a **beat-locked, Ken-Burns image sequence**
> (hard cuts on every K-th detected beat, K=2 default, cycling the covers) instead of a single hero.
> A standalone **`beatCutToBeats(clipIds, k)`** store action re-lays selected image/video clips to
> the song's beats (one undo step) — surfaced via a "Beat-cut" properties-panel control (K = every
> beat / 2 / 4) + command-palette entry. The engine (`lib/beat-cut.ts`, pure + unit-tested) is
> **media-agnostic** — it cuts video clips identically, so generated motion clips (made in Irie
> Video Studio, never inside Irie Cut) can later be dropped in as *accents*; that handoff is
> deferred. Verified in-browser: 3 covers + a click-track song → 7 clips cycling 0,1,2 on the beats;
> standalone action + single-step undo. See `BEAT-CUT-SPEC.md`.
>
> **Update (2026-06-24): Video Studio → Irie Cut handoff (Irie Cut side) is BUILT & VERIFIED.** The
> `.iriepromo.json` envelope is now shared across lanes: it optionally carries **`clips[]`** (video
> data-URLs) and the **song is optional**. `buildPromoProject` assembles a **beat-cut** (when a song
> rides along) or a **sequential** layout (no song) from images and/or clips — reusing the
> media-agnostic engine (`sequentialClips` added for the no-song case). A separate **"Import from
> Video Studio"** button triggers the same importer; Pam imports are unchanged (`promo.source` gains
> `'studio'`). The Video Studio **"Send to Irie Cut"** writer is **also built** (in the
> `irie-video-studio` repo: `/api/irie-cut` + `lib/irie-cut.ts` + Library-page selection/song/CTA).
> **Full loop verified in-browser, both apps:** Video Studio "Send to Irie Cut" (2 clips + a song) →
> `.iriepromo.json` → Irie Cut "Import from Video Studio" → 7 beat-cut video clips on the song's
> beats. Also: studio no-song → 2 sequential clips (no audio track); Pam multi-cover → identical
> (regression). See `STUDIO-HANDOFF-SPEC.md`.
> **Queued next (spec below):** 1.4 promo-template gallery (the import already assembles a full
> starter promo), 1.2-v2 word-level karaoke captions (needs Whisper word timings), 2.3 silence
> removal (talking-head), and the Tier-3 publish-to-Bandstand/Vision targets.

## Context: Pam changes the target

Irie Cut isn't a general editor that happens to do promo. It's the **back half of a release
pipeline** whose front half already exists: **Pam** (github.com/corey470/personal-ai-music) —
Corey's local Suno-style studio that produces the song + its identity (audio WAV/stems, LP-style
cover image, synced lyrics, lyric-video-v2, distributor Release Package).

**The two lanes (do not blur them):**

| | Pam | Irie Cut |
| --- | --- | --- |
| Job | Create the song + its **canonical** artifacts | Make the **promo** from a finished song |
| Output | Release Package, cover, lyric-video-v2 (the "real" video) | Social cutdowns, multi-platform sizes, tour/merch/teaser videos |
| Visual | Cover image (LP ethos) | Cover image **in motion** + animated lyric captions + stem-reactive accents |
| AI video | **Rejected ("slop")** | **Also none** — motion = Ken Burns over the cover (keyframes), not generation |

**Hard constraints inherited from Pam:**
1. **No AI/generative video, ever.** The visual identity is the cover + motion + lyric captions.
2. **Pam is the music source** for Corey's own promos — not a generic royalty-free library.
3. **Pam is local + Cloudflare-Access-gated (Corey only); Irie Cut is a public client-side web app
   on Vercel.** So the integration is a **file handoff** (Pam exports a "promo bundle" → Corey
   imports it into Irie Cut), *not* a live browser→Pam API call. This keeps both apps in their
   security/runtime lanes and is thin (North-Star-safe).

**What already exists in Irie Cut that this builds on** (Phases 1–7, shipped):
keyframes + easing (Ken Burns), animated text presets (fade/pop/slide/typewriter), rich text,
auto-reframe (cover-fit aspect change), WebCodecs frame-accurate export, Whisper auto-captions →
styleable text clips, beat detection + markers + snap, audio FX, brand kit, project bundle import.
Most of the spec below is **wiring existing seams together**, not net-new engines.

---

## The handoff: the Pam "promo bundle"

The single new artifact that connects the two apps. Pam gains a **"Send to Irie Cut"** action
(next to Export for Ableton / Make Release Package) that writes one file:

```
<Title>.iriepromo.json      // single file, media as data-URLs (mirrors project-io)
{
  "iriePromo": 1,
  "title": "...", "artist": "...", "album": "..."|null, "trackNo": 1|null,
  "durationSec": 180.5, "persona": "..."|null,
  "audio":  "data:audio/mpeg;base64,...",          // the ready take's mix
  "cover":  "data:image/jpeg;base64,...",          // the square LP cover
  "lyrics": "raw text with [Section] headers",
  "lines":  [ { "start": 0.0, "end": 3.4, "text": "line" }, ... ],   // = TimedLine, line-level
  "campaign": { "hook": "...", "audience": "...", "captionDraft": "...",
                "teaserIdeas": ["..."], "rolloutNotes": "..." } | null,
  "stems":  { "drums": "data:audio/wav;base64,..." } | null   // optional → beat-sync source
}
```

- `lines[]` is **exactly Irie Cut's caption-cue shape** (`{start,end,text}`) — Pam's `TimedLine`
  flattened — so it drops straight into the store's `addCaptions(cues)`. Zero new caption plumbing.
- `campaign` rides along from Pam's Campaign Builder → pre-fills the post-kit (Tier 3.1).
- Irie Cut side: a new `lib/pam-import.ts` builds a starter promo **project** from the bundle (see
  Tier 1 #1). Reuses the Phase 5.3 bundle-import machinery + `createProject` + `addCaptions`.

**Pam-side effort is small** (it already has audio, cover, synced lyrics, stems, and a Release
Package writer — this is one more bundle writer). Spec'd here so the contract is fixed; the Pam
work lives in the Pam repo.

---

## Tier 1 — the promo rocket (build first)

### 1.1 Pam → Irie Cut import ("Start a promo from this song")
**What:** Import a Pam promo bundle and auto-assemble a starter promo project: cover as a
Ken-Burns hero clip, the song on the audio track, and the synced lyrics as an animated caption
track — editable immediately.
**Data/seam:** new `lib/pam-import.ts: buildPromoProject(bundle) → projectId`. Creates a project,
imports cover (image clip, `fit: 'cover'`, `keyframes` for a slow scale 1.0→1.12 + drift = the
Ken Burns I built), adds the audio clip, and calls the existing `addCaptions(bundle.lyrics)` to lay
styled caption clips. Stems (if present) stored as extra audio assets for #2.5.
**UI:** "Import from Pam" button on the Projects page (next to Import/New), file picker → builds →
opens the editor. (Mirrors Pam's "Send to Irie Cut".)
**Verify:** import a real Pam bundle → project opens with cover animating, song playing, lyric
captions on the timeline at the right times; round-trip a known song and check cue timings.
**Effort:** M. **Reuses:** project-io, addCaptions, keyframes, fit:cover. **Risk:** low.

### 1.2 Animated lyric/caption styling (the engagement lever)
**What:** One-click turn a caption/lyric track into styled, animated, burned-in captions
(line "pop"/"slide"/"karaoke highlight") — the muted-feed promo standard.
**Data/seam:** a `captionStyle` applied across a track: font/size/stroke/shadow/position +
a text preset. v1 = **line-level** using the animated text presets already shipped
(`applyTextPreset`). v2 = **word-level karaoke highlight** now has the core timing path:
auto-captions preserve Whisper `words[]`, attach them to `TextProperties.words`, and render through
the existing karaoke path in `drawText`.
**Store:** `styleCaptionTrack(trackId, style, preset)` — batch-applies to every caption clip
(one undo step).
**UI:** a "Caption style" section (presets gallery: Bold Pop, Karaoke, Minimal, Subtitle) + apply.
**Verify:** v1 via real-renderer pixel reads (already proven for text presets); v2 word-highlight by
sampling the highlighted word's color over time.
**Effort:** S (v1, reuses presets) / M (v2 word karaoke). **Risk:** low (v1), med (v2 timing data).

### 1.3 One-click multi-size export (the distribution lever)
**What:** From one timeline, export 9:16, 1:1, 16:9, 4:5 in a single action — every platform at once.
**Data/seam:** `lib/exporter-multi.ts: exportAllSizes(project, sizes[]) → File[]`. For each size:
clone the project, `reframe(w,h)` (already shipped — cover-fills + respects explicit fit), run
`exportProjectWebCodecs`, collect blobs; download as a set (or a zip).
**UI:** a "Platform sizes" multi-select in the Export dialog (Reels/TikTok 9:16, Feed 1:1,
YouTube 16:9, Portrait 4:5) + "Export all".
**Verify:** export all 4 → ffprobe each for exact dimensions + duration; spot-check a frame per size.
**Effort:** M. **Reuses:** WebCodecs exporter, reframe. **Risk:** low (mostly a loop).

### 1.4 Promo templates + brand kit (the time-to-video lever)
**What:** Real templates (media slots + motion + auto-applied brand kit), themed for the ecosystem:
**Release out now**, **Tour announcement**, **Merch drop** (Swag/Threads), **Snippet teaser**,
**Talking-head intro/outro**.
**Data/seam:** extend `lib/templates.ts` from text-only specs to richer specs (clip slots with
transform/keyframe presets, caption track, brand-color/font hooks). `applyTemplate` already exists;
extend it to place slots + apply the brand kit.
**UI:** the existing Layouts/Templates tab, upgraded with these promo templates + thumbnails.
**Verify:** apply each template to a Pam import → on-brand promo assembles with motion + captions.
**Effort:** M. **Reuses:** templates, brand kit, keyframes. **Risk:** low.

---

## Tier 2 — music-promo power (uses Pam stems)

### 2.1 Beat-synced auto-cut — ✅ BUILT (2026-06-24)
**What:** Snap cuts / scene changes / cover-motion "hits" to the beat — turn raw footage or a
static cover into a punchy, music-locked promo.
**Shipped:** `lib/beat-cut.ts` (`planBeatCut` cuts every K-th beat cycling N sources;
`clipsFromSegments` builds the clips with per-still Ken-Burns; `kenBurnsKeyframes`). Wired into
Pam import (`covers[]` → beat-cut sequence) and a standalone `beatCutToBeats(clipIds, k=2)` store
action with a properties-panel "Beat-cut" control + command-palette entry. **Media-agnostic** so it
cuts video clips too (forward-looking for Irie Video Studio / Higgsfield clips as accents — handoff
deferred, no generation ever inside Irie Cut). Hard cuts; default K=2; one undo step.
**Data/seam:** beat detection already ships (markers + snap). Add `lib/auto-cut.ts`: given beat
times (from the **drums stem** if Pam provided it — cleaner than the mix — else the mix, else `bpm`
grid) + a set of media, auto-place clip boundaries / transform "punch" keyframes on the beats.
**Store:** `autoCutToBeats(clipIds, beatTimes, style)` (one undo step).
**UI:** "Auto-cut to beat" in the timeline toolbar / command palette.
**Verify:** beats land on a known click track within a frame; cuts/keyframes align to markers.
**Effort:** M. **Reuses:** beat-detect, markers, keyframes. **Risk:** med (musicality of the result).

### 2.2 Stem-reactive visual accents
**What:** A visual element (cover zoom-pulse, bar, ring) that reacts to the audio or a chosen stem
— premium, on-brand, **not AI**. Pam's visualizer is gradient+waveform; this rides the cover.
**Data/seam:** precompute an amplitude envelope (per stem) → drive a shape/transform via a new
"audio-reactive" keyframe source in the renderer. Stays in the shared renderer (preview == export).
**UI:** a "React to audio" toggle on a shape/cover clip + stem picker.
**Verify:** envelope matches the audio; the accent pulses on beats; bakes into export.
**Effort:** M–L. **Reuses:** shapes, keyframes, stems. **Risk:** med (new reactive source).

### 2.3 Silence removal (talking-head promos)
**What:** Auto-detect dead air from the waveform and ripple-cut it — for band updates / interviews.
**Data/seam:** `lib/silence.ts`: energy-gate the waveform → silent regions → auto-split +
ripple-delete (both already exist as store actions).
**UI:** "Remove silences" (sensitivity slider) in the command palette / clip menu.
**Verify:** a clip with known gaps → gaps removed, speech preserved, total duration drops correctly.
**Effort:** M. **Reuses:** waveform/beat infra, split + ripple-delete. **Risk:** low–med.

### 2.4 SFX polish library (whooshes/risers/impacts — NOT music)
**What:** A small curated transition-SFX set for promo polish. Music stays Pam's; this is just the
whoosh on a text reveal. Bundle a tiny royalty-free set or load via `/api`.
**Effort:** S–M (content/licensing, not engineering). **Risk:** licensing only.

---

## Tier 3 — thin ecosystem distribution

### 3.1 Publish / handoff + AI promo copy
**What:** After export, stage the promo for the ecosystem — Irie Bandstand post / Vision embed /
social queue — with **AI-written promo copy + hashtags** (from the lyrics/transcript, via the
existing Claude copy `/api`) and an **auto thumbnail** (poster frame on the cover + brand title).
**Data/seam:** reuse `ai-copy` + a poster-frame grab + brand kit; a "publish target" is a thin
handoff (writes a bundle / posts to a webhook), **never** a scheduler living in the editor.
**Constraint:** depends on what each Irie platform exposes — **size by your API access, not by code
difficulty.** Start with the lowest-friction target (likely a Bandstand draft or a downloadable
"post kit": video + copy + hashtags + thumbnail).
**Effort:** M (per target). **Risk:** external (platform APIs).

---

## Recommended build order

1. **1.1 Pam import** + **1.2 caption styling (v1)** — the spine. A finished Pam song becomes an
   editable, captioned promo in two clicks. Highest impact, mostly reuse.
2. **1.3 multi-size export** — fire that promo to every platform. Pure leverage over the WebCodecs
   engine.
3. **1.4 promo templates + brand** — collapses time-to-video for the recurring formats.
4. **2.1 beat-sync** + **2.3 silence removal** — the music-promo and talking-head power tools.
5. **3.1 publish/handoff** — once 1–2 prove the loop, wire the thinnest distribution target.
6. Defer **2.2 stem-reactive** and **2.4 SFX** until the core loop is in daily use.

## Effort / risk at a glance

| Feature | Tier | Effort | Risk | Mostly reuse? |
| --- | --- | --- | --- | --- |
| 1.1 Pam import | 1 | M | low | yes |
| 1.2 caption styling v1 / v2 | 1 | S / M | low / med | yes / partial |
| 1.3 multi-size export | 1 | M | low | yes |
| 1.4 promo templates + brand | 1 | M | low | yes |
| 2.1 beat-synced auto-cut | 2 | M | med | yes |
| 2.2 stem-reactive accents | 2 | M–L | med | partial |
| 2.3 silence removal | 2 | M | low–med | yes |
| 2.4 SFX library | 2 | S–M | licensing | n/a |
| 3.1 publish + AI copy | 3 | M | external | yes |

## Decisions (grounded in the Pam repo, 2026-06-24)

Dug into `~/Documents/irie-music-app` (= `corey470/personal-ai-music`). Answers:

1. **Lyric granularity → LINE/SECTION-level, not word-level.** A `Take` has `lyrics` (text with
   `[Section]` headers) + `sections: {name,startSec,endSec}[]`; `lib/lyrics/synced.ts` interpolates
   `TimedLine {text,isHeader,startSec,endSec}`. → Irie Cut captions are **line-level animated**
   (pop/slide, reusing the shipped text presets). Word-level karaoke is a *later* option via Whisper
   word timings — not blocking.
2. **BPM → not stored** (only mentioned inside free-text style prompts). → beat-sync **detects from
   audio** (the shipped beat detector), preferring the **drums stem** when the bundle includes it.
3. **First publish target → the Campaign Builder is the lock point.** Pam *already* has a
   `ReleaseCampaign` (`hook`, `audience`, `captionDraft`, `teaserIdeas[]`, `rolloutNotes`) +
   Listening Room. So Irie Cut **inherits the campaign** and the first "publish" is a **downloadable
   post-kit** (rendered video + caption + hashtags + thumbnail) — zero external API. Bandstand/Vision
   targets come later.
4. **Handoff format → a single `.iriepromo.json`** with media as data-URLs (mirrors Irie Cut's
   existing `project-io` bundle — dependency-free, portable across machines, no zip lib; Irie Cut is
   a web app and can't read Pam's local FS). Pam side mirrors `packageForRelease.ts`:
   `lib/export/packageForIrieCut.ts` + `POST /api/takes/[id]/irie-cut` + an `ExportPackage`
   record (`kind: "irie-cut"`), and surfaces a "Send to Irie Cut" button next to Make Release
   Package — and ideally on the Campaign Builder so the campaign rides along.

**The Campaign Builder discovery refines the lanes:** Pam = song + canonical artifacts + the campaign
*plan* (hook/caption/teasers). Irie Cut = turn that plan into the actual promo *videos*, multi-size,
and emit the post-kit. Tier 3's "AI copy" is then mostly *inheriting Pam's campaign*, not regenerating it.
