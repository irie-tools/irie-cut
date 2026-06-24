// Per-clip in/out transitions, composited on the canvas so they render in the
// preview AND bake into the export. Each clip can ease in at its start and ease
// out at its end. A clip fading out next to one fading in reads as a crossfade.

import type { Clip } from '#/types/editor'

export interface TransitionSpec {
  type: string
  duration: number
}

export interface TransitionOption {
  id: string
  label: string
}

export const TRANSITIONS: TransitionOption[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-left', label: 'Slide left' },
  { id: 'slide-right', label: 'Slide right' },
  { id: 'slide-up', label: 'Slide up' },
  { id: 'slide-down', label: 'Slide down' },
  { id: 'zoom-in', label: 'Zoom in' },
  { id: 'zoom-out', label: 'Zoom out' },
  { id: 'wipe-left', label: 'Wipe left' },
  { id: 'wipe-right', label: 'Wipe right' },
]

export interface TransitionModifier {
  alpha: number
  /** Translation as a fraction of canvas width/height. */
  dx: number
  dy: number
  /** Uniform scale around the clip centre. */
  scale: number
  /** Reveal rectangle as fractions of the canvas (0..1), or null for full. */
  clip: { x: number; y: number; w: number; h: number } | null
}

const IDENTITY: TransitionModifier = { alpha: 1, dx: 0, dy: 0, scale: 1, clip: null }

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Apply an entering transition. `p` runs 0 (just started) → 1 (fully in). */
function enter(type: string, p: number, m: TransitionModifier) {
  const e = 1 - p
  switch (type) {
    case 'fade':
      m.alpha *= p
      break
    case 'slide-left':
      m.dx += e
      break
    case 'slide-right':
      m.dx -= e
      break
    case 'slide-up':
      m.dy += e
      break
    case 'slide-down':
      m.dy -= e
      break
    case 'zoom-in':
      m.scale *= 0.6 + 0.4 * p
      m.alpha *= p
      break
    case 'zoom-out':
      m.scale *= 1.4 - 0.4 * p
      m.alpha *= p
      break
    case 'wipe-left':
      m.clip = { x: 0, y: 0, w: p, h: 1 }
      break
    case 'wipe-right':
      m.clip = { x: 1 - p, y: 0, w: p, h: 1 }
      break
  }
}

/** Apply an exiting transition. `q` runs 1 (full) → 0 (gone). */
function exit(type: string, q: number, m: TransitionModifier) {
  const e = 1 - q
  switch (type) {
    case 'fade':
      m.alpha *= q
      break
    case 'slide-left':
      m.dx -= e
      break
    case 'slide-right':
      m.dx += e
      break
    case 'slide-up':
      m.dy -= e
      break
    case 'slide-down':
      m.dy += e
      break
    case 'zoom-in':
      m.scale *= 1 + 0.4 * e
      m.alpha *= q
      break
    case 'zoom-out':
      m.scale *= 1 - 0.4 * e
      m.alpha *= q
      break
    case 'wipe-left':
      m.clip = { x: 0, y: 0, w: q, h: 1 }
      break
    case 'wipe-right':
      m.clip = { x: 1 - q, y: 0, w: q, h: 1 }
      break
  }
}

/** Compute the visual modifier for a clip at time `t` from its in/out transitions. */
export function transitionModifier(clip: Clip, t: number): TransitionModifier {
  const tin = clip.transitionIn
  const tout = clip.transitionOut
  if ((!tin || tin.type === 'none') && (!tout || tout.type === 'none')) return IDENTITY

  const m: TransitionModifier = { alpha: 1, dx: 0, dy: 0, scale: 1, clip: null }
  const start = clip.start
  const end = clip.start + clip.duration

  if (tin && tin.type !== 'none' && tin.duration > 0 && t < start + tin.duration) {
    enter(tin.type, clamp01((t - start) / tin.duration), m)
  }
  if (tout && tout.type !== 'none' && tout.duration > 0 && t > end - tout.duration) {
    exit(tout.type, clamp01((end - t) / tout.duration), m)
  }
  return m
}
