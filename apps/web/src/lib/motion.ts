// Cover/image motion presets. The old import stretched ONE slow zoom across a
// whole song (1.0→1.12 over 3+ minutes ≈ invisible). These generate motion that
// is actually perceptible and *scales to the clip's length* — multi-phase moves
// that cycle every ~15s, plus beat-reactive and reveal styles. Pure + testable;
// no generation (still honours the no-AI-video / no-slop rule).

import type { Clip } from '#/types/editor'

export type MotionPreset = 'cinematic' | 'pushPan' | 'driftReveal' | 'punchIn' | 'beatPulse' | 'none'

export const MOTION_PRESETS: { id: MotionPreset; label: string }[] = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'pushPan', label: 'Push & pan' },
  { id: 'driftReveal', label: 'Drift & reveal' },
  { id: 'punchIn', label: 'Punch in' },
  { id: 'beatPulse', label: 'Beat pulse' },
  { id: 'none', label: 'None' },
]

type Ease = 'linear' | 'in' | 'out' | 'inout' | 'hold'
type KF = { t: number; value: number; ease?: Ease }
type Keyframes = NonNullable<Clip['keyframes']>

function r(n: number): number {
  return Math.round(n * 1000) / 1000
}

export interface MotionOptions {
  duration: number
  /** Clip-local beat times (seconds), for the beatPulse preset. */
  beats?: number[]
  /** Seconds per motion phase for the cyclic presets (default 15). */
  cycle?: number
}

/** Phase boundary times across [0, D]: 0, cycle, 2·cycle, …, D (unique, sorted). */
function phaseTimes(D: number, cycle: number): number[] {
  const times = [0]
  for (let t = cycle; t < D - 0.4; t += cycle) times.push(r(t))
  times.push(r(D))
  return times
}

/** Cyclic push/pan: alternating zoom in/out, panning around. Pan stays inside overscan. */
function cyclic(D: number, cycle: number, lo: number, hi: number, panFactor: number): Keyframes {
  const times = phaseTimes(D, cycle)
  const scale: KF[] = []
  const x: KF[] = []
  const y: KF[] = []
  times.forEach((t, i) => {
    const zoom = i % 2 === 0 ? lo : hi
    const amp = (zoom - 1) * panFactor // < (zoom-1)/2, so the pan never reveals an edge
    const ang = i * 2.2
    const last = i === times.length - 1
    scale.push({ t, value: r(zoom), ease: last ? undefined : 'inout' })
    x.push({ t, value: r(amp * Math.cos(ang)), ease: last ? undefined : 'inout' })
    y.push({ t, value: r(amp * Math.sin(ang)), ease: last ? undefined : 'inout' })
  })
  return { scale, x, y }
}

/** Start tight on a corner, pull back to reveal, then push into another area. */
function driftReveal(D: number): Keyframes {
  const mid = r(D * 0.42)
  return {
    scale: [
      { t: 0, value: 1.22, ease: 'inout' },
      { t: mid, value: 1.06, ease: 'inout' },
      { t: r(D), value: 1.18 },
    ],
    x: [
      { t: 0, value: 0.08, ease: 'inout' },
      { t: mid, value: 0, ease: 'inout' },
      { t: r(D), value: -0.06 },
    ],
    y: [
      { t: 0, value: -0.05, ease: 'inout' },
      { t: r(D), value: 0.04 },
    ],
  }
}

/** Calm base drift with sharp zoom punches at a steady interval. */
function punchIn(D: number, every = 6): Keyframes {
  const base = 1.06
  const scale: KF[] = [{ t: 0, value: base, ease: 'inout' }]
  for (let tp = every; tp < D - 0.3; tp += every) {
    scale.push({ t: r(tp), value: 1.17, ease: 'out' })
    scale.push({ t: r(Math.min(D - 0.05, tp + 0.5)), value: base, ease: 'inout' })
  }
  scale.push({ t: r(D), value: base })
  return {
    scale,
    x: [
      { t: 0, value: -0.03, ease: 'inout' },
      { t: r(D), value: 0.03 },
    ],
  }
}

/** Base drift with a scale punch on every beat (the music-reactive style). */
function beatPulse(D: number, beats: number[]): Keyframes {
  const base = 1.07
  // Thin to a musical cadence (≥0.3s apart) so it punches, not flutters.
  const MIN_GAP = 0.3
  let lastPulse = -1
  const kf: KF[] = [{ t: 0, value: base, ease: 'inout' }]
  for (const bt of [...beats].sort((a, b) => a - b)) {
    if (bt <= 0.06 || bt >= D - 0.06 || bt - lastPulse < MIN_GAP) continue
    lastPulse = bt
    kf.push({ t: r(bt), value: 1.15, ease: 'out' })
    kf.push({ t: r(Math.min(D - 0.02, bt + 0.14)), value: base, ease: 'inout' })
  }
  kf.push({ t: r(D), value: base })
  // de-dupe near-equal times (keep first), keep sorted
  kf.sort((a, b) => a.t - b.t)
  const scale: KF[] = []
  for (const k of kf) if (!scale.length || Math.abs(scale[scale.length - 1].t - k.t) > 1e-3) scale.push(k)
  // if there were no usable beats, fall back to a visible cyclic move
  if (scale.length <= 2) return cyclic(D, 8, 1.06, 1.16, 0.4)
  return {
    scale,
    x: [
      { t: 0, value: -0.025, ease: 'inout' },
      { t: r(D), value: 0.025 },
    ],
  }
}

/** Build keyframes for a motion preset, scaled to the clip duration. */
export function motionKeyframes(preset: MotionPreset, opts: MotionOptions): Keyframes {
  const D = Math.max(0.5, opts.duration)
  const cycle = opts.cycle ?? 15
  switch (preset) {
    case 'none':
      return {}
    case 'cinematic':
      return cyclic(D, cycle, 1.1, 1.2, 0.4)
    case 'pushPan':
      return cyclic(D, Math.max(cycle, 20), 1.06, 1.16, 0.45)
    case 'driftReveal':
      return driftReveal(D)
    case 'punchIn':
      return punchIn(D)
    case 'beatPulse':
      return beatPulse(D, opts.beats ?? [])
  }
}
