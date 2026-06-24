// Beat-cut planner (Tier 2.1). Pure + deterministic: given detected beat times
// and a set of media sources, decide cut points (every K-th beat, cycling the
// sources) and build the resulting clips. Media-agnostic — stills get a
// per-clip Ken-Burns push; video clips are placed without added motion. No
// generation, no I/O. Consumed by lib/pam-import and the editor store.

import type { Clip } from '#/types/editor'

export interface BeatCutSegment {
  sourceIndex: number
  start: number
  duration: number
}

export interface BeatCutSource {
  mediaId: string
  type: 'image' | 'video'
  /** Visible length of the source (trimEnd - trimStart) — used to clamp video segments. */
  sourceDuration?: number
}

export interface PlanBeatCutOptions {
  beats: number[]
  songDuration: number
  sourceCount: number
  /** Cut every k-th beat (>=1). Default 2. */
  k?: number
  /** Start of the cut region, seconds. Default 0. */
  startAt?: number
  /** Minimum segment length, seconds. Default 0.2. */
  minSegment?: number
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Plan beat-locked segments, cycling sources. Pure + deterministic. */
export function planBeatCut(opts: PlanBeatCutOptions): BeatCutSegment[] {
  const { beats, songDuration, sourceCount } = opts
  const k = Math.max(1, Math.floor(opts.k ?? 2))
  const startAt = Math.max(0, opts.startAt ?? 0)
  const minSeg = opts.minSegment ?? 0.2
  if (sourceCount < 1 || songDuration <= startAt) return []

  // Candidate cut points: every k-th beat strictly inside (startAt, songDuration),
  // each at least minSeg after the previous accepted cut.
  const inRange = beats.filter((b) => b > startAt + 1e-6 && b < songDuration - 1e-6).sort((a, b) => a - b)
  const cuts: number[] = [startAt]
  for (let i = 0; i < inRange.length; i += k) {
    const t = inRange[i]
    if (t - cuts[cuts.length - 1] >= minSeg) cuts.push(t)
  }

  // No usable beats → even split across the sources.
  if (cuts.length < 2) {
    const span = songDuration - startAt
    const seg = span / sourceCount
    if (seg < minSeg) return [{ sourceIndex: 0, start: round3(startAt), duration: round3(span) }]
    return Array.from({ length: sourceCount }, (_, i) => {
      const s = startAt + i * seg
      const d = i === sourceCount - 1 ? songDuration - s : seg
      return { sourceIndex: i, start: round3(s), duration: round3(d) }
    })
  }

  // Build segments between consecutive cuts; the last runs to songDuration.
  const segs: BeatCutSegment[] = []
  for (let i = 0; i < cuts.length; i++) {
    const s = cuts[i]
    const e = i + 1 < cuts.length ? cuts[i + 1] : songDuration
    const d = e - s
    if (d < minSeg && segs.length) {
      // Too tight — absorb into the previous segment.
      const prev = segs[segs.length - 1]
      prev.duration = round3(e - prev.start)
      continue
    }
    segs.push({ sourceIndex: 0, start: round3(s), duration: round3(d) })
  }
  // Assign cycling source indices by final position.
  segs.forEach((seg, i) => (seg.sourceIndex = i % sourceCount))
  return segs
}

/** A slow scale push + slight horizontal drift; direction alternates by index. */
export function kenBurnsKeyframes(duration: number, index: number): NonNullable<Clip['keyframes']> {
  const dir = index % 2 === 0 ? 1 : -1
  const end = round3(duration)
  return {
    scale: [
      { t: 0, value: 1, ease: 'inout' },
      { t: end, value: 1.08 },
    ],
    x: [
      { t: 0, value: 0, ease: 'inout' },
      { t: end, value: round3(0.03 * dir) },
    ],
  }
}

/** Build timeline clips from planned segments. Images get Ken-Burns; video is clamped, no motion. */
export function clipsFromSegments(args: {
  segments: BeatCutSegment[]
  sources: BeatCutSource[]
  trackId: string
  makeId: () => string
}): Clip[] {
  const { segments, sources, trackId, makeId } = args
  return segments.map((seg, i) => {
    const src = sources[seg.sourceIndex] ?? sources[0]
    if (src.type === 'video') {
      const visible = src.sourceDuration ? Math.min(seg.duration, src.sourceDuration) : seg.duration
      const dur = round3(visible)
      return {
        id: makeId(), trackId, type: 'video', name: 'Clip', mediaId: src.mediaId,
        start: seg.start, duration: dur, trimStart: 0, trimEnd: dur, volume: 1, fit: 'cover',
      }
    }
    return {
      id: makeId(), trackId, type: 'image', name: 'Cover', mediaId: src.mediaId,
      start: seg.start, duration: seg.duration, trimStart: 0, trimEnd: seg.duration, volume: 1, fit: 'cover',
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      keyframes: kenBurnsKeyframes(seg.duration, i),
    }
  })
}

/** Lay sources end-to-end at natural lengths (no song = no beat-cut). Images get Ken-Burns. */
export function sequentialClips(args: {
  sources: BeatCutSource[]
  trackId: string
  makeId: () => string
  stillDuration?: number
}): Clip[] {
  const { sources, trackId, makeId } = args
  const still = args.stillDuration ?? 3
  let t = 0
  return sources.map((src, i) => {
    if (src.type === 'video') {
      const dur = round3(src.sourceDuration && src.sourceDuration > 0 ? src.sourceDuration : still)
      const clip: Clip = {
        id: makeId(), trackId, type: 'video', name: 'Clip', mediaId: src.mediaId,
        start: round3(t), duration: dur, trimStart: 0, trimEnd: dur, volume: 1, fit: 'cover',
      }
      t += dur
      return clip
    }
    const dur = round3(still)
    const clip: Clip = {
      id: makeId(), trackId, type: 'image', name: 'Cover', mediaId: src.mediaId,
      start: round3(t), duration: dur, trimStart: 0, trimEnd: dur, volume: 1, fit: 'cover',
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      keyframes: kenBurnsKeyframes(dur, i),
    }
    t += dur
    return clip
  })
}
