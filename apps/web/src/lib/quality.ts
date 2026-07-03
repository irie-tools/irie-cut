// Lightweight per-clip quality helpers. These intentionally use native canvas
// filter operations so preview and export stay identical in the shared renderer.

export interface ClipQuality {
  /** Adds a mild contrast/saturation lift without inventing detail. */
  enhance?: boolean
  /** 0..1 noise-softening blur amount. Kept subtle to avoid plastic footage. */
  denoise?: number
}

const EPS = 1e-3

export function isNeutralQuality(q: Partial<ClipQuality> | undefined): boolean {
  if (!q) return true
  return !q.enhance && Math.abs(q.denoise ?? 0) < EPS
}

export function qualityCss(q: Partial<ClipQuality> | undefined): string {
  if (isNeutralQuality(q)) return ''
  const parts: string[] = []
  if (q?.enhance) parts.push('contrast(1.08)', 'saturate(1.08)', 'brightness(1.02)')
  const denoise = Math.max(0, Math.min(1, q?.denoise ?? 0))
  if (denoise >= EPS) parts.push(`blur(${round(denoise * 0.7)}px)`)
  return parts.join(' ')
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
