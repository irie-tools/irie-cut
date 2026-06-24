// Keyframe interpolation for per-clip motion (Phase 1: Motion & Keyframes).
// Pure, no React. Shared by the renderer (preview + export) and the store.
//
// A keyframe track is a time-sorted list of { t, value } where `t` is seconds
// relative to the clip's start. A property with no track uses the clip's static
// transform value (the `fallback`); with a track, linear interpolation wins.

import type { Clip } from '#/types/editor'

export type KeyframeProp = 'x' | 'y' | 'scale' | 'rotation' | 'opacity'

/** Easing applied to the segment that STARTS at a keyframe. */
export type Easing = 'linear' | 'in' | 'out' | 'inout' | 'hold'

export const EASINGS: { id: Easing; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'inout', label: 'Smooth' },
  { id: 'in', label: 'Ease in' },
  { id: 'out', label: 'Ease out' },
  { id: 'hold', label: 'Hold' },
]

export interface Keyframe {
  t: number
  value: number
  ease?: Easing
}

/** Map a 0..1 progress through an easing curve. */
export function applyEase(f: number, ease: Easing | undefined): number {
  switch (ease) {
    case 'in':
      return f * f
    case 'out':
      return 1 - (1 - f) * (1 - f)
    case 'inout':
      return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2
    case 'hold':
      return 0
    default:
      return f
  }
}

export const KEYFRAME_PROPS: readonly KeyframeProp[] = ['x', 'y', 'scale', 'rotation', 'opacity']

/** Identity transform — the fallback when a clip has neither transform nor keyframes. */
const TRANSFORM_DEFAULTS: Record<KeyframeProp, number> = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

/**
 * Linear-interpolate a keyframe track at clip-local time `t`. Values clamp to
 * the first/last keyframe beyond the ends. Returns `fallback` when the track is
 * empty/absent (so the static transform value applies).
 */
export function keyframeValueAt(keys: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!keys || keys.length === 0) return fallback
  if (keys.length === 1) return keys[0].value
  if (t <= keys[0].t) return keys[0].value
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.value
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      if (span <= 0) return b.value
      const f = applyEase((t - a.t) / span, a.ease)
      return a.value + (b.value - a.value) * f
    }
  }
  return last.value
}

/**
 * Resolve a clip's effective transform at clip-local time `clipLocalTime`,
 * per-property: keyframes override the static `transform`, which overrides the
 * identity default.
 */
export function transformAt(
  clip: Clip,
  clipLocalTime: number,
): { x: number; y: number; scale: number; rotation: number; opacity: number } {
  const tr = clip.transform
  const kf = clip.keyframes
  const resolve = (p: KeyframeProp): number =>
    keyframeValueAt(kf?.[p], clipLocalTime, tr ? tr[p] : TRANSFORM_DEFAULTS[p])
  return {
    x: resolve('x'),
    y: resolve('y'),
    scale: resolve('scale'),
    rotation: resolve('rotation'),
    opacity: resolve('opacity'),
  }
}

/** Deduped, time-sorted union of every keyframe time on the clip (for timeline markers). */
export function keyframeTimes(clip: Clip): number[] {
  const kf = clip.keyframes
  if (!kf) return []
  const set = new Set<number>()
  for (const p of KEYFRAME_PROPS) {
    const arr = kf[p]
    if (arr) for (const k of arr) set.add(k.t)
  }
  return [...set].sort((a, b) => a - b)
}

/** True if the clip has at least one keyframe on any property. */
export function hasKeyframes(clip: Clip): boolean {
  const kf = clip.keyframes
  if (!kf) return false
  return KEYFRAME_PROPS.some((p) => (kf[p]?.length ?? 0) > 0)
}

/** Insert or replace a keyframe at ~`t` (within `eps`), returning a new sorted track. */
export function upsertKeyframe(
  keys: Keyframe[] | undefined,
  t: number,
  value: number,
  eps = 1e-3,
): Keyframe[] {
  const prev = keys?.find((k) => Math.abs(k.t - t) <= eps)
  const next = keys ? keys.filter((k) => Math.abs(k.t - t) > eps) : []
  next.push(prev?.ease ? { t, value, ease: prev.ease } : { t, value })
  next.sort((a, b) => a.t - b.t)
  return next
}

/** Remove the keyframe at ~`t` (within `eps`), returning a new track. */
export function removeKeyframeAt(keys: Keyframe[] | undefined, t: number, eps = 1e-3): Keyframe[] {
  if (!keys) return []
  return keys.filter((k) => Math.abs(k.t - t) > eps)
}

/** The time of the keyframe nearest `t` within `tol`, or null if none is close. */
export function keyframeAtTime(keys: Keyframe[] | undefined, t: number, tol: number): number | null {
  if (!keys) return null
  let best: number | null = null
  let bestD = tol
  for (const k of keys) {
    const d = Math.abs(k.t - t)
    if (d <= bestD) {
      bestD = d
      best = k.t
    }
  }
  return best
}
