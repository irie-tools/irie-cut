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
- Added workflow-specific score checks in `apps/web/src/lib/score.ts`:
  - 16:9 HD music-video format
  - continuous music bed coverage
  - loop/background clip variety
  - chapter markers for track starts
- Added unit tests in `apps/web/src/lib/score.test.ts`.

## Not pulled

- No external Suno, Kling, Higgsfield, Google Flow, YouTube, or CapCut dependency was added.
- No monetization claim is hard-coded. The source's YouTube policy claims should stay in docs/checklists unless verified from current platform guidance.
- The broader side-hustle ideas in the source files belong to other Irie products, not Irie Cut.

## Next product slices

- Add a Music Pack assembler that places N audio tracks sequentially, repeats M loop clips across the runtime, and creates markers at each track start.
- Add a metadata export for YouTube title, description, tags, and chapters.
- Add loop-seam review support so a user can verify the first/last frame before batching clips.
