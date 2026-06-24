// Per-clip color adjustments (Phase 2.1). Maps to a CSS/canvas `filter` string
// applied via `ctx.filter`, composed *after* any color-grade preset — so the
// adjustment shows in the live preview AND is baked into the exported video
// (same shared renderer). All four channels are exact native filter functions.
//
// Temperature/tint (true channel-mixing) is intentionally left to the WebGL
// color grade pass, where it can be done accurately rather than approximated.

export interface ClipAdjust {
  /** 1 = neutral. */
  brightness: number
  /** 1 = neutral. */
  contrast: number
  /** 1 = neutral (0 = greyscale, 2 = double saturation). */
  saturation: number
  /** Degrees, 0 = neutral. */
  hue: number
}

export const DEFAULT_ADJUST: ClipAdjust = { brightness: 1, contrast: 1, saturation: 1, hue: 0 }

const EPS = 1e-3

export function isNeutralAdjust(a: Partial<ClipAdjust> | undefined): boolean {
  if (!a) return true
  return (
    Math.abs((a.brightness ?? 1) - 1) < EPS &&
    Math.abs((a.contrast ?? 1) - 1) < EPS &&
    Math.abs((a.saturation ?? 1) - 1) < EPS &&
    Math.abs(a.hue ?? 0) < EPS
  )
}

/** Build the canvas `filter` fragment for a clip's adjustments ('' when neutral). */
export function adjustCss(a: Partial<ClipAdjust> | undefined): string {
  if (isNeutralAdjust(a)) return ''
  const b = a!.brightness ?? 1
  const c = a!.contrast ?? 1
  const s = a!.saturation ?? 1
  const h = a!.hue ?? 0
  const parts: string[] = []
  if (Math.abs(b - 1) >= EPS) parts.push(`brightness(${round(b)})`)
  if (Math.abs(c - 1) >= EPS) parts.push(`contrast(${round(c)})`)
  if (Math.abs(s - 1) >= EPS) parts.push(`saturate(${round(s)})`)
  if (Math.abs(h) >= EPS) parts.push(`hue-rotate(${round(h)}deg)`)
  return parts.join(' ')
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
