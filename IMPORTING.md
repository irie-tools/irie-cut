# Bringing your work into Irie Cut

_The exact operation for the Pam → Irie Cut and Video Studio → Irie Cut handoffs._
_(This is also surfaced in-app: Projects page → the **?** next to "Bring in".)_

Irie Cut imports **one `.iriepromo.json` file** — the song, art, and (for Pam) lyrics packed into a
single self-contained bundle (media is embedded as data-URLs). Make it upstream in Pam or Video
Studio, then choose it on the Projects page. **Nothing uploads to a server** — the file is read in
your browser.

---

## From Pam — a song + its cover

**In Pam (`~/Documents/irie-music-app`, local app):**
1. Open a **finished take** (status `ready`). It needs a **square cover image** and **audio**.
2. Click **"Send to Irie Cut"** (in the Song Workbench, next to the take).
3. Pam writes `<Title>.iriepromo.json` into your **Pam Promos** folder
   (default `~/Pam Promos/<Title>/`, or your configured release destination) and shows the path.

**In Irie Cut:**
4. Projects page → **"From Pam"** → choose that `.iriepromo.json`.

**You get:** the cover as a slow Ken-Burns hero, the song on the audio track, and synced lyric
captions — ready to edit.

**What Pam exports** (`lib/export/packageForIrieCut.ts`):
`{ iriePromo:1, title, artist, album, trackNo, durationSec, persona, audio (mp3 data-URL),
cover (one square LP cover), lyrics, lines (synced caption cues), campaign, stems:null }`.

> Note: Pam sends **one** cover today (single-cover hero). To **beat-cut several covers**, add the
> extra covers in the Irie Cut editor and use "Cut to beat" — or bring motion clips from Video
> Studio (below), which beat-cut on import.

---

## From Video Studio — clips, optionally a song

**In Video Studio (`~/Documents/HEYGEN/irie-video-studio`, staging app):**
1. Go to **Library**.
2. **Tick the clips** you want (the "Select" control on each card).
3. Optional: **"Add a song"** (a local audio file) so the clips cut to the beat.
4. Click **"Send N to Irie Cut"** — it **downloads** `<title>.iriepromo.json` (to your Downloads).

**In Irie Cut:**
5. Projects page → **"From Video Studio"** → choose that file.

**You get:** with a song, the clips **cut to the beat** on import; without one, they lay out as a
clean **sequence** — add a song in the editor, then "Cut to beat."

**What Video Studio exports** (`src/lib/irie-cut.ts` + `POST /api/irie-cut`):
`{ iriePromo:1, source:'studio', title, clips:[video data-URLs], audio?:audio data-URL }`.
The route fetches the selected library clips server-side (dodging CORS) and packs them in; it
**renders nothing** — only repackages clips you already made.

---

## The bundle contract (Irie Cut side)

Both handoffs produce the same envelope, read by `apps/web/src/lib/pam-import.ts:buildPromoProject`:

```jsonc
{
  "iriePromo": 1,
  "source": "pam" | "studio",        // optional; inferred (clips-only ⇒ studio)
  "title": "...",
  "audio":  "data:audio/...;base64,...",   // optional (the song / music bed)
  "cover":  "data:image/...;base64,...",   // optional (Pam canonical cover)
  "covers": ["data:image/...", ...],       // optional (extra image variations)
  "clips":  ["data:video/...", ...],       // optional (Video Studio video clips)
  "lines":  [{ "start": 0, "end": 3.4, "text": "..." }],  // optional captions
  "campaign": { "...": "..." } | null
}
```

Valid if `iriePromo === 1` **and** at least one visual source is present (`cover`, `covers`, or
`clips`). With a song → beat-cut; without → sequential. "Project file" (the other button) is a
different thing — that re-opens an Irie Cut project you exported from here, not a promo bundle.

Specs: `PROMO-PIPELINE.md`, `BEAT-CUT-SPEC.md`, `STUDIO-HANDOFF-SPEC.md`.
