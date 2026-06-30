# Remotion Superpowers Extraction

Research source:

- Local clone: `/Users/irieagent/Documents/repo-research/remotion-superpowers`
- Upstream: `DojoCodingLabs/remotion-superpowers`
- License: MIT
- Boundary: read-only supporting research source

## Verdict

Extract ideas only. Do not install, vendor, or treat the repo as canonical for Irie Cut.

The research repo is a Claude/Remotion workflow pack. It is not an editor codebase. Its core value is production process: planning, asset discipline, caption style, review loops, and timing rules. Its runtime path depends on external MCP/API services such as KIE, TwelveLabs, Pexels, ElevenLabs, and Replicate. Irie Cut keeps a different contract: the editor runs client-side with zero network, and AI stays optional behind dependency-free `/api` functions.

Maintenance check on 2026-06-28 found the upstream repo public, MIT licensed, young, small, and not archived. Open issues reported broken Claude hook schema and a TwelveLabs stdio/HTTP transport mismatch. That confirms the repo is useful as research, not as something to adopt whole.

## Pulled Into Irie Cut

### 1. Preserve word timing in auto-captions

Useful source idea: Remotion Superpowers treats word-level captions as a first-class social-video feature.

Irie Cut already receives Whisper word timings from `/api/ai-transcribe`, but the auto-caption path only used phrase cues. This update keeps the word timings, attaches them to text clips as clip-local `text.words`, and enables the existing karaoke renderer. Preview and export still share `renderer.ts`.

Files:

- `apps/web/src/lib/caption-words.ts`
- `apps/web/src/lib/caption-words.test.ts`
- `apps/web/src/stores/editor-store.ts`
- `apps/web/src/components/editor/ai-panel.tsx`

### 2. Document the research boundary

Useful source idea: production workflow packs can help Irie Cut without changing Irie Cut into an external-service production bot.

This file records the decision, source-truth boundary, and what should happen next.

Files:

- `REMOTION-SUPERPOWERS-EXTRACTION.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `README.md`

### 3. Export Readiness scorecard

Useful source idea: the review loop should catch issues before a video leaves the editor.

Irie Cut now turns that into deterministic timeline checks instead of external video analysis. The scorecard and export dialog inspect the actual project for blank openings, visual gaps, text size, platform safe zones, audio ending fades, and unmanaged loud audio overlap. The export dialog surfaces the top readiness issues before rendering.

Files:

- `apps/web/src/lib/score.ts`
- `apps/web/src/lib/score.test.ts`
- `apps/web/src/components/editor/score-dialog.tsx`
- `apps/web/src/components/editor/export-dialog.tsx`

## Queued Ideas

These are worth building only if they stay inside Irie Cut's editor-first shape.

1. **Storyboard or production brief import**
   Convert a plain production plan into a starter timeline: scenes, target aspect, hooks, CTA, placeholders, and caption style. Keep it local. Do not make it call stock, TTS, music, or video-gen services by default.

2. **Media provenance and asset audit**
   Add source metadata to imported/generated media: origin app, provider, prompt, license, attribution, and created date. Surface missing/orphaned media in bundle/export flows. Adapt the idea to IndexedDB; do not copy the Remotion `public/` folder model.

3. **Auto-ducking**
   Add a store action that lowers music under voiceover by writing volume keyframes. Use `audio.ts` so preview and export match.

## Rejected Ideas

- Remotion renderer or `@remotion/*` packages.
- MCP server config from the research repo.
- TwelveLabs review as a default quality gate.
- KIE, Replicate, ElevenLabs, or Pexels as core editor dependencies.
- AI video generation inside Irie Cut's core.
- The upstream hook scripts as-is.

## Source-Truth Rule

Irie Cut owns its editor runtime. Outside repos may supply patterns, checklists, and design ideas, but every shipped feature must fit:

- shared preview/export renderer and audio seams
- `mutate()` store edits with undo/redo
- client-only core
- optional AI only
- real browser/export verification
