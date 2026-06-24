// Per-clip reveal masks (Phase 2.3). The clip is drawn into a clip-local layer,
// then this module erases everything outside (or inside, when inverted) the mask
// shape using destination-in/out compositing — so the mask affects only its own
// clip, not the tracks beneath it. Shared by preview + export.

export type MaskShape = 'rect' | 'ellipse' | 'linear'

export interface ClipMask {
  shape: MaskShape
  /** Centre, 0..1 of the canvas. */
  x: number
  y: number
  /** Size, 0..1 of the canvas (full width/height of the shape). */
  w: number
  h: number
  /** Linear gradient angle in degrees. */
  angle?: number
  /** Edge softness, 0 (hard) .. 1 (very soft). */
  feather?: number
  /** Reveal outside the shape instead of inside. */
  invert?: boolean
}

export const MASK_SHAPES: { id: MaskShape; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'linear', label: 'Linear' },
]

export const DEFAULT_MASK: ClipMask = {
  shape: 'rect',
  x: 0.5,
  y: 0.5,
  w: 0.6,
  h: 0.6,
  angle: 0,
  feather: 0,
  invert: false,
}

/** Paint the mask's reveal region as opaque white over transparent (a destination alpha). */
export function paintMaskShape(ctx: CanvasRenderingContext2D, mask: ClipMask, W: number, H: number) {
  const cx = mask.x * W
  const cy = mask.y * H
  const hw = Math.max(1, (mask.w * W) / 2)
  const hh = Math.max(1, (mask.h * H) / 2)
  const feather = Math.max(0, Math.min(1, mask.feather ?? 0))
  ctx.fillStyle = '#ffffff'

  if (mask.shape === 'ellipse') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(hw, hh)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    const solid = Math.max(0, Math.min(0.999, 1 - feather))
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(solid, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  if (mask.shape === 'linear') {
    const a = ((mask.angle ?? 0) * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const band = Math.max(1, feather * Math.max(W, H) * 0.5)
    const grad = ctx.createLinearGradient(cx - dx * band, cy - dy * band, cx + dx * band, cy + dy * band)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    return
  }

  // Rectangle. Feather softens the edges via a shadow-blurred fill.
  if (feather > 0) {
    const blur = feather * Math.min(hw, hh)
    ctx.save()
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = blur
    ctx.fillRect(cx - hw + blur, cy - hh + blur, (hw - blur) * 2, (hh - blur) * 2)
    ctx.restore()
  } else {
    ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2)
  }
}

/** Erase the layer outside (or inside, if inverted) the mask region. */
export function applyClipMask(ctx: CanvasRenderingContext2D, mask: ClipMask, W: number, H: number) {
  ctx.save()
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = mask.invert ? 'destination-out' : 'destination-in'
  paintMaskShape(ctx, mask, W, H)
  ctx.restore()
}
