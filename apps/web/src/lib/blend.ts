// Per-clip blend modes (Phase 2.2). Each maps directly to a canvas
// `globalCompositeOperation`, applied in the shared renderer so the blend shows
// in preview AND export. 'normal' (source-over) is the default.

export interface BlendMode {
  id: GlobalCompositeOperation
  label: string
}

export const BLEND_MODES: BlendMode[] = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'color-dodge', label: 'Color Dodge' },
  { id: 'color-burn', label: 'Color Burn' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'difference', label: 'Difference' },
  { id: 'exclusion', label: 'Exclusion' },
  { id: 'hue', label: 'Hue' },
  { id: 'saturation', label: 'Saturation' },
  { id: 'color', label: 'Color' },
  { id: 'luminosity', label: 'Luminosity' },
  { id: 'lighter', label: 'Add' },
]

const VALID = new Set(BLEND_MODES.map((b) => b.id))

/** Normalize a stored blend value to a canvas op; unknown/normal → 'source-over'. */
export function blendOp(blend: string | undefined): GlobalCompositeOperation {
  if (!blend || !VALID.has(blend as GlobalCompositeOperation)) return 'source-over'
  return blend as GlobalCompositeOperation
}

export function isNeutralBlend(blend: string | undefined): boolean {
  return blendOp(blend) === 'source-over'
}
