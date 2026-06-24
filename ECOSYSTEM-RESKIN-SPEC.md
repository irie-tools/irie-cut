# Irie Cut — Ecosystem Re-skin + Front-Door Reposition (design)

_Spec date: 2026-06-24._

> **Update (same day): the accent evolved from gold to Irie green.** This spec landed first as a
> gold/Cormorant re-skin (the family standard). On review Corey wanted the front door *livelier and
> more music*, so Irie Cut took its own sound-system voice: the **red / gold / green** energy palette
> with a single **Irie-green `#25c281`** accent flowing through the whole app (landing, projects,
> editor), **Bebas Neue** marquee display + **Space Grotesk** body, and an animated, video-ready hero.
> The structure/positioning below still holds; the gold-accent + Cormorant token values are
> superseded by the green + Bebas/Space-Grotesk values now in `styles.css`.

## Why

Corey: Irie Cut should **"read as a product in my ecosystem"** — not a standalone open-source editor
and not a standalone music-video tool, but **a room in the Irie house**. Today it wears the coat it
was forked from (OpenCut): a **cyan** accent, **Playfair + Inter**, a cool blue-charcoal canvas. The
rest of the Irie family (Threads, Video Studio, Suite, Commerce) follows the **Irie Ecosystem Design
Standard** (`paperclip-irie-config/DESIGN.md`): one warm near-black canvas, a single **gold** accent,
**Cormorant Garamond + DM Sans**, editorial restraint, canvas-first editors. The mismatch is why
Irie Cut reads as an orphan. Fix = wear the family coat **and** speak as a family member.

## Decision (Corey delegated: "you make the call")

**Whole-app re-skin** (landing, projects, AND editor — so opening the editor still feels like the
family) **+ front-door reposition** as the cut-and-finish room of the Irie pipeline **+ projects-page
polish**. The accent/canvas/fonts are centralized tokens, so the re-skin is one coherent token swap,
not a thousand edits.

## Family tokens (from the canonical standard)

- **Accent gold** `#C9A84C` (light `#E8C96A`, deep `#A68838`). The single accent across every surface.
- **Gold glow** (primary CTA hover only): `0 0 20px rgba(201,168,76,0.35), 0 0 40px rgba(201,168,76,0.15)`.
- **Canvas** warm near-black `#0b0b0b` (never pure black); **surface** `#1a1a1a`; **elevated** `#242424`.
- **Text** cream `#F2EDE4`; **muted** `rgba(242,237,228,0.55)`.
- **Border** warm-neutral hairline `rgba(242,237,228,0.10)` (gold reserved for accent/focus/emphasis,
  not every divider — keeps the dense editor calm).
- **Type** display `Cormorant Garamond` (`--font-heading`), body `DM Sans` (`--font-sans`); max 3
  weights; uppercase tracking-widest eyebrows. Self-hosted via `@fontsource` (offline — hard rule #3).
- State semantics (destructive/success) stay functional and never compete with gold.

## Scope of changes

1. **`styles.css` (the re-skin — one file).** Swap the `.dark` tokens to the family values above;
   `--font-heading` → Cormorant, `--font-sans` → DM Sans; add `@fontsource` imports; add a reusable
   `.gold-glow` hover utility. The app is forced dark (`<html class="dark">`), so only `.dark` matters.
   This alone re-skins landing + projects + editor at once.

2. **`routes/index.tsx` (front door reposition).** Rewrite to the landing doctrine, positioned as an
   ecosystem product:
   - **Hero** — outcome + belonging. Eyebrow: "Part of the Irie ecosystem · free · on-device."
     Headline (Cormorant): your song + your visuals, cut to the beat. Sub: made in Pam and Video
     Studio → cut and finished here → exported every size, on your machine, no account. Primary gold
     CTA + quiet "View the source." Proof cue.
   - **Hero visual** — replace the decorative gradient with a real **beat-cut**: cover/clip segments
     snapping to beat markers over a waveform (the visual must explain the promise).
   - **First scroll = the pipeline** ("From a finished song to a posted promo": Pam / Video Studio →
     Irie Cut → out), not a generic feature row.
   - **Beat-cut shown** (multi-image/clip → beats → multi-size + captions, outcomes not labels).
   - **It's a real editor** (existing multi-track/captions/precise-cut/export, reframed as proof).
   - **Trust** (on-device, no account/watermark, open source). **Final CTA.** **Footer** closes the
     promise (not a link farm).

3. **`routes/projects.tsx` (polish).** Family canvas + gold accents; nicer project cards (thumbnail,
   hover lift, clean meta/actions); warmer empty state; tidy the header so the doors read as
   intentional lanes (From Pam · From Video Studio · New), not a button row.

## Constraints

- Single gold accent; warm canvas; never pure black/white. (Canonical standard.)
- Client-only, offline-safe: self-hosted fonts, no Google CDN. (AGENTS hard rule #3.)
- Canvas-first editor: the re-skin must not add chrome that competes with the preview; verify the
  dense editor still reads cleanly in gold-on-dark before calling done.
- Mobile-first: hero + projects usable at 375px; CTAs full-width on mobile; 44px targets.
- No new data-model or behavior changes — this is identity + copy + layout only.

## Verification (primarily visual — the real test for a re-skin)

Browser (Playwright) screenshots at desktop **and** 375px for: landing (hero + each section),
projects page, and the **editor** (confirm gold-on-dark reads sharp, nothing cyan left, timeline/
preview still clear). Run the Landing Page Test + the Irie Test before done. `tsc --noEmit` + `vite
build` clean. Full test suite still green (no logic touched).

## Build order (small, separately-committed slices)

1. `styles.css` token re-skin + fonts + `.gold-glow`. Screenshot landing/projects/editor (before
   any copy change) to confirm the coat alone looks family + nothing broke.
2. `index.tsx` front-door rewrite + beat-cut hero visual.
3. `projects.tsx` polish.
4. Docs (README/ROADMAP note + this spec).

## Not in this build

- No editor feature/behavior changes (only its skin moves to gold-on-dark).
- No new ecosystem nav/hub or cross-product links beyond naming Pam + Video Studio in copy.
- No light-mode work (app ships dark).
