# AI Music Video Workflow Extraction

Source files:
- `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge/summary.md`
- `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge/actions.md`
- `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge/ideas.md`
- `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge/builder-brief.md`
- `/Users/irieagent/Documents/irie-tools/grabs/The_Best_AI_Side_Hustle_Ideas_NO_ONE_Is_Talking_About/knowledge/project-matches.md`

## Fit verdict

The useful Irie Cut signal is the faceless YouTube music-video assembly workflow:

1. Generate several songs in a consistent niche.
2. Generate a style/reference still.
3. Animate that still into seamless loop clips.
4. Assemble the tracks and loop clips into a long 16:9 YouTube video.
5. Add markers/chapters, metadata, and a final export-readiness check before publishing.

The source says "CapCut" for the assembly step. In Irie Cut terms that maps to:

- import audio tracks and loop clips,
- use a 16:9 music-channel layout,
- cover the full runtime with background visuals,
- keep the music bed continuous,
- add track-start markers for YouTube chapters,
- export through the existing MP4 pipeline.

## Implemented in Irie Cut

- Added a `YouTube Music Video` layout in `apps/web/src/lib/templates.ts`.
- The template sets a 1920x1080 canvas, dark background, sound-bar visualizer defaults, and starter title text.
- Added `project.workflow.kind = "youtube-music-video"` so readiness can be context-aware without changing every project.
- Added Pam YouTube Album Release import support for `iriePromo: 2`, `kind: "youtube_album_release"` folders.
- Album imports now stop at a review/preflight screen before project creation. The review shows track order, duration, found/missing audio, found/missing videos, lyrics/caption counts, chapter coverage, and lets the user attach replacement files for missing assets.
- The review includes Music Video Formula Packs inspired by current AI MV workflow research: Album Art Motion, Studio Performance, Cinematic R&B, Rap / Street Visual, Anime MV, Dreamy Fantasy, Lyric Visualizer, and Shorts Hook Cutdown.
- Each formula sets visual treatment, caption strategy, export targets, enhance/prep intent, and creative direction notes. Prep actions are recorded honestly as project notes today; they are hooks for future real enhance/denoise/stabilize/optical-flow processing, not fake processing.
- Final album assembly places track audio in order, uses existing or replacement track videos when present, creates fallback visuals, adds lyrics captions from lyrics files, and creates timeline markers from chapters.
- Added workflow-specific score checks in `apps/web/src/lib/score.ts`:
  - 16:9 HD music-video format
  - continuous music bed coverage
  - loop/background clip variety
  - chapter markers for track starts
- Added unit tests in `apps/web/src/lib/score.test.ts`.

## Not pulled

- No external Suno, Kling, Higgsfield, Google Flow, YouTube, or CapCut dependency was added.
- No Sondo dependency or workflow API was added. Its blog was treated as a pattern source for formula packs: music synchronization, visual consistency, genre-fit, and social export planning.
- No monetization claim is hard-coded. The source's YouTube policy claims should stay in docs/checklists unless verified from current platform guidance.
- The broader side-hustle ideas in the source files belong to other Irie products, not Irie Cut.
- Irie Cut cannot silently read sibling files from a single JSON import because browsers block that. Pam Album import asks the user to choose the whole release folder so the browser exposes relative paths safely.

## Next product slices

- Add a YouTube metadata/post-kit export that uses the selected formula to shape title, description, tags, thumbnail prompt text, chapters, and upload checklist.
- Add real prep processors behind the captured enhance queue: browser-safe denoise/enhance first, then optional server/VPS jobs for stabilize and optical-flow.
- Add loop-seam review support so a user can verify the first/last frame before batching clips.
- Add a caption timing editor that lets imported lyric lines be nudged before export without digging through timeline clips.
- Add a storyboard/reference breakdown layer that turns a selected formula into song-section scene briefs before timeline assembly.
