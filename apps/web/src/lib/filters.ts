// Color-grade filter presets. Each maps to a CSS/canvas filter string applied
// via `ctx.filter` when drawing a clip — so the grade shows in the preview AND
// is baked into the exported video (the studio's version was preview-only).

export interface FilterPreset {
  id: string
  label: string
  /** A canvas `filter` value, or '' for no filter. */
  css: string
  /** A small CSS gradient used as the swatch in the picker. */
  swatch: string
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: 'None', css: '', swatch: 'linear-gradient(135deg,#52525b,#27272a)' },
  { id: 'warm', label: 'Warm', css: 'saturate(1.25) sepia(0.18) brightness(1.05)', swatch: 'linear-gradient(135deg,#fbbf24,#f97316)' },
  { id: 'cool', label: 'Cool', css: 'saturate(1.1) hue-rotate(-12deg) brightness(0.97) contrast(1.08)', swatch: 'linear-gradient(135deg,#38bdf8,#6366f1)' },
  { id: 'cinema', label: 'Cinema', css: 'contrast(1.18) saturate(1.12) brightness(0.95)', swatch: 'linear-gradient(135deg,#14532d,#0f172a)' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.12) brightness(1.03)', swatch: 'linear-gradient(135deg,#ec4899,#f59e0b)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(0.92) brightness(1.05) saturate(1.1)', swatch: 'linear-gradient(135deg,#d6b48a,#a16207)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.1)', swatch: 'linear-gradient(135deg,#e5e5e5,#404040)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.4) brightness(0.9)', swatch: 'linear-gradient(135deg,#a3a3a3,#0a0a0a)' },
  { id: 'fade', label: 'Fade', css: 'contrast(0.85) brightness(1.1) saturate(0.85)', swatch: 'linear-gradient(135deg,#cbd5e1,#94a3b8)' },
  { id: 'night', label: 'Night', css: 'brightness(0.82) contrast(1.2) saturate(0.9) hue-rotate(200deg)', swatch: 'linear-gradient(135deg,#1e3a8a,#020617)' },
]

const BY_ID = new Map(FILTER_PRESETS.map((f) => [f.id, f]))

/** Resolve a clip filter id to its canvas filter string ('none' / unknown → ''). */
export function filterCss(id: string | undefined): string {
  if (!id || id === 'none') return ''
  return BY_ID.get(id)?.css ?? ''
}
