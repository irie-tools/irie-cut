// Story "beat roles" + edit-decision-list / cutdown export. Ported from the
// media studio's producer layer: tag clips with a narrative role, then emit a
// structured EDL or an auto-cutdown plan derived from the real timeline.

import type { Clip, Project, Track } from '#/types/editor'

export interface BeatRole {
  id: string
  label: string
  /** Tailwind text color for the badge. */
  color: string
}

export const BEAT_ROLES: BeatRole[] = [
  { id: 'none', label: 'None', color: 'text-muted-foreground' },
  { id: 'hook', label: 'Hook', color: 'text-rose-400' },
  { id: 'problem', label: 'Problem', color: 'text-orange-400' },
  { id: 'proof', label: 'Proof', color: 'text-emerald-400' },
  { id: 'product', label: 'Product', color: 'text-sky-400' },
  { id: 'human', label: 'Human moment', color: 'text-violet-400' },
  { id: 'benefit', label: 'Benefit', color: 'text-teal-400' },
  { id: 'cta', label: 'CTA', color: 'text-amber-400' },
]

const ROLE_LABEL = new Map(BEAT_ROLES.map((r) => [r.id, r.label]))

export function roleLabel(id: string | undefined): string | undefined {
  if (!id || id === 'none') return undefined
  return ROLE_LABEL.get(id)
}

/** Roles included in an auto-cutdown short, in priority order. */
export const CUTDOWN_ROLES = ['hook', 'proof', 'cta']

interface FlatClip {
  clip: Clip
  track: Track
}

function orderedClips(project: Project): FlatClip[] {
  const flat: FlatClip[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) flat.push({ clip, track })
  }
  return flat.sort((a, b) => a.clip.start - b.clip.start)
}

function pad(n: number, w = 2): string {
  return Math.floor(n).toString().padStart(w, '0')
}

/** Format seconds as SMPTE-ish HH:MM:SS:FF using the project fps. */
export function timecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(Math.max(0, seconds) * fps)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`
}

function projectDuration(project: Project): number {
  let max = 0
  for (const t of project.tracks) for (const c of t.clips) max = Math.max(max, c.start + c.duration)
  return max
}

/** Count of clips per (non-none) role, plus the ordered role sequence. */
export function beatSummary(project: Project): { counts: Record<string, number>; sequence: string[] } {
  const counts: Record<string, number> = {}
  const sequence: string[] = []
  for (const { clip } of orderedClips(project)) {
    const label = roleLabel(clip.role)
    if (!label) continue
    counts[label] = (counts[label] ?? 0) + 1
    sequence.push(label)
  }
  return { counts, sequence }
}

/** A structured edit-decision-list describing every clip on the timeline. */
export function buildEdl(project: Project) {
  const fps = project.fps || 30
  return {
    version: 1,
    generator: 'Irie Cut',
    project: {
      name: project.name,
      width: project.width,
      height: project.height,
      fps,
    },
    duration: round(projectDuration(project)),
    clips: orderedClips(project).map(({ clip, track }, i) => ({
      index: i + 1,
      track: track.type,
      type: clip.type,
      role: roleLabel(clip.role) ?? null,
      name: clip.type === 'text' ? (clip.text?.content ?? 'Text') : clip.name,
      timeline: {
        start: round(clip.start),
        end: round(clip.start + clip.duration),
        duration: round(clip.duration),
      },
      timecode: {
        in: timecode(clip.start, fps),
        out: timecode(clip.start + clip.duration, fps),
      },
      source:
        clip.type === 'text'
          ? null
          : { mediaId: clip.mediaId ?? null, trimStart: round(clip.trimStart), trimEnd: round(clip.trimEnd) },
      filter: clip.filter && clip.filter !== 'none' ? clip.filter : null,
    })),
  }
}

/** An auto-cutdown plan: the hook/proof/cta beats in timeline order. */
export function buildCutdown(project: Project, roles: string[] = CUTDOWN_ROLES) {
  const fps = project.fps || 30
  const wanted = new Set(roles)
  const segments = orderedClips(project)
    .filter(({ clip }) => clip.role && wanted.has(clip.role))
    .map(({ clip }) => ({
      role: roleLabel(clip.role),
      name: clip.type === 'text' ? (clip.text?.content ?? 'Text') : clip.name,
      start: round(clip.start),
      end: round(clip.start + clip.duration),
      duration: round(clip.duration),
      timecode: { in: timecode(clip.start, fps), out: timecode(clip.start + clip.duration, fps) },
    }))
  return {
    version: 1,
    generator: 'Irie Cut',
    type: 'cutdown',
    project: project.name,
    roles,
    segments,
    totalDuration: round(segments.reduce((sum, s) => sum + s.duration, 0)),
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
