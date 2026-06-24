// Audio mixing math, shared by the live preview and the exporter so what you
// hear matches what renders: per-clip volume, per-track gain, mute/solo,
// master gain, and fade in/out envelopes derived from clip transitions.

import type { Clip, Project, Track } from '#/types/editor'

/** Linear fade envelope (0..1) from a clip's in/out transitions (any type fades audio). */
export function audioEnvelope(clip: Clip, t: number): number {
  let env = 1
  const start = clip.start
  const end = clip.start + clip.duration
  const tin = clip.transitionIn
  const tout = clip.transitionOut
  if (tin && tin.type !== 'none' && tin.duration > 0 && t < start + tin.duration) {
    env *= Math.max(0, Math.min(1, (t - start) / tin.duration))
  }
  if (tout && tout.type !== 'none' && tout.duration > 0 && t > end - tout.duration) {
    env *= Math.max(0, Math.min(1, (end - t) / tout.duration))
  }
  return env
}

/** Whether any track in the project is soloed. */
export function anySolo(project: Project): boolean {
  return project.tracks.some((t) => t.solo)
}

/**
 * Effective output gain (0..1) for a clip on a track at time `t`, combining
 * clip volume, track volume, mute/solo, master volume, and the fade envelope.
 */
export function effectiveGain(
  project: Project,
  track: Track,
  clip: Clip,
  t: number,
  soloActive: boolean,
): number {
  if (track.muted) return 0
  if (soloActive && !track.solo) return 0
  const clipVol = Math.max(0, Math.min(1, clip.volume))
  const trackVol = track.volume ?? 1
  const master = project.masterVolume ?? 1
  return clipVol * trackVol * master * audioEnvelope(clip, t)
}
