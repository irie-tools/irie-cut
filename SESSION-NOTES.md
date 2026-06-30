# Session notes — 2026-06-24

## Addendum — 2026-06-28

Reviewed `/Users/irieagent/Documents/repo-research/remotion-superpowers` as a read-only research
source. Verdict: extract ideas only. Implemented the useful caption piece without adopting Remotion,
MCP servers, or external-service dependencies: auto-captions now keep Whisper word timings, attach
them to text clips through `lib/caption-words.ts`, and render word-by-word highlight through the
existing shared canvas renderer. The decision trail lives in `REMOTION-SUPERPOWERS-EXTRACTION.md`.

Follow-up on 2026-06-30: added deterministic Export Readiness on top of the scorecard. The checks now
catch blank openings, visual gaps, tiny or unsafe text, hard audio endings, and loud overlapping audio,
then show the top issues in the export dialog before rendering.

A "when I come back to this" note: what we built today, and an honest read on
turning Irie Cut into a paid product. Everything below is **live** on
`irie-cut.vercel.app` and committed to `main` (verified in a real browser, not
just claimed).

---

## What we accomplished today

Started the day with: a solid in-browser editor + a Pam→Irie Cut import that
made a single captioned cover promo. Ended with a real **make-your-own
karaoke / music-video studio.**

1. **Multi-image beat-cut engine** (`lib/beat-cut.ts`). Pam can send N cover
   variations; Irie Cut cuts them to the song's beat (every K beats, cycling,
   Ken-Burns per still). A standalone "Cut to beat" action does it for any
   selected clips. The engine is **media-agnostic** — it cuts video clips too.
2. **The two-way ecosystem bridge.**
   - **Pam → Irie Cut**: "From Pam" imports the `.iriepromo.json` (song + covers
     + lyrics + campaign).
   - **Video Studio → Irie Cut**: built a "Send to Irie Cut" button in the Video
     Studio repo (Library → pick clips → optional song → downloads a bundle), and
     "From Video Studio" import here. Clips beat-cut on arrival.
3. **A real identity.** Re-skinned the whole app onto a music-forward look — the
   Irie red/gold/green **energy palette** with an **Irie-green accent**, Bebas
   Neue + Space Grotesk type — a **live front door** (a real screen-recording of
   the editor running in the hero), a polished projects "cutting room," and a
   richer footer.
4. **In-app import instructions** (`IMPORTING.md` + the `?` on the Projects page)
   — the exact operation for each handoff, so you never lose an hour after a gap.
5. **Cover motion that actually moves** (`lib/motion.ts`). Fixed the dead "it
   just pulses": the old import stretched one zoom across a whole song
   (invisible). Now a multi-phase cinematic Ken-Burns is the default, plus a
   **Motion menu** (Cinematic / Push & pan / Drift & reveal / Punch in / Beat
   pulse).
6. **Captions re-synced to the audio + word-by-word karaoke**
   (`lib/lyric-sync.ts`, `lib/audio-prep.ts`, renderer karaoke). The lag was
   estimated timing that drifted late; now we measure it from the vocal with
   Whisper word-timings and **keep your exact lyrics** on the audio's timeline.
   "Re-sync captions to the music" in the AI panel. (Verified live: a line moved
   from Pam's 34.2s estimate → 11.0s real.)
7. **The on-frame sound bar** (`lib/audio-spectrum.ts`, renderer). A real FFT
   spectrum visualizer baked into the frame — mirrored so the **bass pumps at
   both ends**, a bass-colour flash, a size/colour/position you can tune, on by
   default for music. Reacts in preview and bakes into the export.

Tests: 54+ unit tests; the AI/transcription path verified end-to-end on
production with a real song.

---

## The idea: could this be a paid SaaS?

Corey's read (2026-06-24): *"the perfect home producer's karaoke machine — make
your own song, learn it, do karaoke… I'd pay $29/mo for this."* (Reference
point: paid Suno $29/mo for two months.) The maker saying "I'd pay for it" is
the realest product signal there is. Here's the honest path.

### Why it's sellable-grade
- It's a **loop no one quite owns**: make a song → cut/caption/karaoke/visualize
  it → a finished music video of a song that didn't exist this morning. Suno
  makes songs; CapCut edits; nobody integrates the whole thing with a no-slop bar.
- It's **real** (built + verified, no fake dashboards) — people feel that.
- The editor is **already client-side, portable, and deployed** — most of the
  product already exists and is cheap to run (everything renders on-device).

### The one real knot
**Pam is local + Cloudflare-Access-gated + it's Corey's own music source.** A
product other people use can't depend on Pam. So:

- **Recommended path — "Bring your own song."** Irie Cut becomes a standalone
  *"turn your song into a karaoke music video"* web app: a user drops an mp3
  (from Suno or anywhere) → auto-caption + word karaoke + beat-cut + sound bar +
  multi-size export. This sidesteps needing a music engine entirely. Pam and
  Video Studio stay **Corey's personal power-ups** (or a later "pro" tier).
- (Alternative — integrate a music-gen engine — is a much bigger lift: cost, IP,
  model hosting. Not the first move.)

### What would need to happen (concrete, roughly in order)
1. **A BYO-song entry path** — "drop an mp3 → it builds the promo" (we already
   have all the downstream pieces; just need the front door for raw audio +
   auto-run motion/captions/visualizer).
2. **Accounts + billing** — currently no-account by design. Add optional auth +
   Stripe ($29/mo, or freemium: free editing, paid AI features). Projects can
   stay local; the paywall sits on the AI features (transcription/copy/images).
3. **Meter the AI costs** — transcription/copy/images cost a few cents per use
   (fine at $29/mo). Need a business-owned key + usage limits so a heavy user
   can't run up the bill. Today the OpenAI key in Vercel is Corey's personal one.
4. **Polish the rough edges** — move the spectrum FFT + the Whisper chunking off
   the main thread (a worker) so long songs don't hitch; word-level karaoke
   precision pass (align each word, not interpolate within lines).
5. **Positioning** — reframe the (already strong) landing from "the Irie
   ecosystem cutting room" to "make/​bring a song → get a karaoke music video,"
   keeping the same look.
6. **Legal** — BYO audio = the user's responsibility; keep the no-AI-generated-
   video / no-slop ethos as a brand promise.

### Honest caveats
- "$29/mo" is the **maker's** signal, not market proof. Validation = a handful of
  other musicians using it and not churning.
- Whisper hears sung audio imperfectly (timing is good; a word can mishear).
- A product means **support + maintenance** — real, ongoing work.
- None of this needs deciding now. Keeping it personal is completely valid; the
  fact that it's *sellable* is just proof it's good.

---

_It started as "okay, this'll be alright." It ended as a tool the maker would pay
for. That's the whole game._
