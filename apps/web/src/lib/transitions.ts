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
  { id: 'wipe-up', label: 'Wipe up' },
  { id: 'wipe-down', label: 'Wipe down' },
  { id: 'spin', label: 'Spin' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'zoom-blur', label: 'Zoom blur' },
]

export interface TransitionModifier {
  alpha: number
  /** Translation as a fraction of canvas width/height. */
  dx: number
  dy: number
  /** Uniform scale around the clip centre. */
  scale: number
  /** Rotation around the clip centre, in degrees. */
  rotate: number
  /** Reveal rectangle as fractions of the canvas (0..1), or null for full. */
  clip: { x: number; y: number; w: number; h: number } | null
}

const IDENTITY: TransitionModifier = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, clip: null }

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** Deterministic 0..1 hash for glitch jitter. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
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
    case 'wipe-up':
      m.clip = { x: 0, y: 1 - p, w: 1, h: p }
      break
    case 'wipe-down':
      m.clip = { x: 0, y: 0, w: 1, h: p }
      break
    case 'spin':
      m.rotate += -120 * e
      m.scale *= 0.5 + 0.5 * p
      m.alpha *= p
      break
    case 'glitch': {
      const seed = Math.floor(p * 28)
      m.dx += (hash(seed) - 0.5) * 0.1 * e
      m.dy += (hash(seed + 9) - 0.5) * 0.06 * e
      m.alpha *= (0.55 + 0.45 * hash(seed + 3)) * (0.4 + 0.6 * p)
      break
    }
    case 'zoom-blur':
      m.scale *= 2 - p
      m.alpha *= p * p
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
    case 'wipe-up':
      m.clip = { x: 0, y: 1 - q, w: 1, h: q }
      break
    case 'wipe-down':
      m.clip = { x: 0, y: 0, w: 1, h: q }
      break
    case 'spin':
      m.rotate += 120 * e
      m.scale *= 1 - 0.5 * e
      m.alpha *= q
      break
    case 'glitch': {
      const seed = Math.floor(q * 28)
      m.dx += (hash(seed) - 0.5) * 0.1 * e
      m.dy += (hash(seed + 9) - 0.5) * 0.06 * e
      m.alpha *= (0.55 + 0.45 * hash(seed + 3)) * (0.4 + 0.6 * q)
      break
    }
    case 'zoom-blur':
      m.scale *= 2 - q
      m.alpha *= q * q
      break
  }
}

/** Compute the visual modifier for a clip at time `t` from its in/out transitions. */
export function transitionModifier(clip: Clip, t: number): TransitionModifier {
  const tin = clip.transitionIn
  const tout = clip.transitionOut
  if ((!tin || tin.type === 'none') && (!tout || tout.type === 'none')) return IDENTITY

  const m: TransitionModifier = { alpha: 1, dx: 0, dy: 0, scale: 1, rotate: 0, clip: null }
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
