// Pure frame renderer: given a project, a time, and a way to resolve the
// drawable element for each clip, paint one frame into a 2D canvas context.
// Coordinates are in project pixel space (canvas backing-store size).

import type { Clip, Project } from '#/types/editor'
import { filterCss } from '#/lib/filters'
import { adjustCss } from '#/lib/adjust'
import { blendOp } from '#/lib/blend'
import { applyClipMask } from '#/lib/mask'
import { chromaKey } from '#/lib/chroma'
import { transitionModifier, type TransitionModifier } from '#/lib/transitions'
import { transformAt } from '#/lib/keyframes'

/** Reused offscreen layer for clip-local compositing (masks). Sized to the project. */
let scratch: HTMLCanvasElement | null = null
function getScratch(W: number, H: number): HTMLCanvasElement {
  if (!scratch) scratch = document.createElement('canvas')
  if (scratch.width !== W || scratch.height !== H) {
    scratch.width = W
    scratch.height = H
  }
  return scratch
}

/** Combined canvas `filter` for a clip: color-grade preset + per-clip adjustments. */
function effectiveFilter(clip: Clip): string {
  const combined = [filterCss(clip.filter), adjustCss(clip.adjust)].filter(Boolean).join(' ')
  return combined || 'none'
}

/**
 * Composite one video/image clip: transform → transition → filter/adjust →
 * blend mode → (mask) → draw. Shared by preview + export. `srcW/srcH` are the
 * source's natural dimensions; `box` is its contain-fit destination rect.
 */
function compositeMedia(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  el: CanvasImageSource,
  srcW: number,
  srcH: number,
  box: { x: number; y: number; w: number; h: number },
  time: number,
  W: number,
  H: number,
) {
  // Chroma key first (GPU pass) — the keyed canvas then composites like any source.
  let drawable: CanvasImageSource = el
  if (clip.chroma) {
    const keyed = chromaKey(el, srcW, srcH, clip.chroma)
    if (keyed) drawable = keyed
  }

  if (clip.mask) {
    // Layered path: draw + mask in a clip-local layer, then composite with blend
    // so the mask only erases this clip (not the tracks beneath it).
    const layer = getScratch(W, H)
    const lctx = layer.getContext('2d')!
    lctx.clearRect(0, 0, W, H)
    lctx.save()
    applyClipTransform(lctx, clip, time, W, H)
    applyTransition(lctx, transitionModifier(clip, time), W, H)
    lctx.filter = effectiveFilter(clip)
    lctx.globalCompositeOperation = 'source-over'
    lctx.drawImage(drawable, box.x, box.y, box.w, box.h)
    lctx.restore()
    applyClipMask(lctx, clip.mask, W, H)

    ctx.save()
    ctx.globalCompositeOperation = blendOp(clip.blend)
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
    return
  }

  ctx.save()
  applyClipTransform(ctx, clip, time, W, H)
  applyTransition(ctx, transitionModifier(clip, time), W, H)
  ctx.filter = effectiveFilter(clip)
  ctx.globalCompositeOperation = blendOp(clip.blend)
  ctx.drawImage(drawable, box.x, box.y, box.w, box.h)
  ctx.restore()
}

export interface RenderSources {
  getVideo: (clipId: string) => HTMLVideoElement | undefined
  getImage: (mediaId: string) => HTMLImageElement | undefined
}

export function clipActiveAt(clip: Clip, time: number): boolean {
  return time >= clip.start && time < clip.start + clip.duration
}

/** Scale `srcW x srcH` to fit inside `dstW x dstH` (contain), returning a centred box. */
function containBox(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH }
  const scale = Math.min(dstW / srcW, dstH / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

/** Scale `srcW x srcH` to cover `dstW x dstH` (fill + crop), returning a centred box. */
function coverBox(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH }
  const scale = Math.max(dstW / srcW, dstH / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

/** Fit box for a clip, honoring its `fit` mode (default contain). */
function fitBox(clip: Clip, srcW: number, srcH: number, W: number, H: number) {
  return (clip.fit === 'cover' ? coverBox : containBox)(srcW, srcH, W, H)
}

/**
 * Apply a clip's effective transform (position/scale/rotation/opacity) at
 * `time`, resolving keyframe animation via `transformAt`. Caller must ctx.save()
 * first. Clips with no transform and no keyframes resolve to identity (no-op).
 */
function applyClipTransform(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  time: number,
  W: number,
  H: number,
) {
  const tr = transformAt(clip, time - clip.start)
  ctx.globalAlpha *= Math.max(0, Math.min(1, tr.opacity))
  if (tr.x || tr.y) ctx.translate(tr.x * W, tr.y * H)
  if (tr.scale !== 1 || tr.rotation) {
    ctx.translate(W / 2, H / 2)
    if (tr.rotation) ctx.rotate((tr.rotation * Math.PI) / 180)
    if (tr.scale !== 1) ctx.scale(tr.scale, tr.scale)
    ctx.translate(-W / 2, -H / 2)
  }
}

/** Apply a transition modifier to the context. Caller must ctx.save() first. */
function applyTransition(ctx: CanvasRenderingContext2D, m: TransitionModifier, W: number, H: number) {
  ctx.globalAlpha *= m.alpha
  if (m.dx || m.dy) ctx.translate(m.dx * W, m.dy * H)
  if (m.scale !== 1 || m.rotate) {
    ctx.translate(W / 2, H / 2)
    if (m.rotate) ctx.rotate((m.rotate * Math.PI) / 180)
    if (m.scale !== 1) ctx.scale(m.scale, m.scale)
    ctx.translate(-W / 2, -H / 2)
  }
  if (m.clip) {
    ctx.beginPath()
    ctx.rect(m.clip.x * W, m.clip.y * H, m.clip.w * W, m.clip.h * H)
    ctx.clip()
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  sh: NonNullable<Clip['shape']>,
  W: number,
  H: number,
) {
  const cx = sh.x * W
  const cy = sh.y * H
  const w = sh.w * W
  const h = sh.h * H
  const hasFill = !!sh.fill && sh.fill !== 'none'
  const hasStroke = !!sh.stroke && sh.strokeWidth > 0
  ctx.lineWidth = sh.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (sh.stroke) ctx.strokeStyle = sh.stroke
  if (sh.fill) ctx.fillStyle = sh.fill

  if (sh.kind === 'rect') {
    const x = cx - w / 2
    const y = cy - h / 2
    const r = Math.min(sh.radius ?? 0, w / 2, h / 2)
    ctx.beginPath()
    if (r > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
    else ctx.rect(x, y, w, h)
    if (hasFill) ctx.fill()
    if (hasStroke) ctx.stroke()
  } else if (sh.kind === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2)
    if (hasFill) ctx.fill()
    if (hasStroke) ctx.stroke()
  } else {
    // line / arrow: a horizontal segment through the centre (rotate via transform).
    const x1 = cx - w / 2
    const x2 = cx + w / 2
    ctx.beginPath()
    ctx.moveTo(x1, cy)
    ctx.lineTo(x2, cy)
    ctx.stroke()
    if (sh.kind === 'arrow') {
      const a = Math.max(10, sh.strokeWidth * 3.5)
      ctx.beginPath()
      ctx.moveTo(x2, cy)
      ctx.lineTo(x2 - a, cy - a * 0.6)
      ctx.moveTo(x2, cy)
      ctx.lineTo(x2 - a, cy + a * 0.6)
      ctx.stroke()
    }
  }
}

/** Characters revealed per second for the typewriter animation. */
const TYPEWRITER_CPS = 20

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, localTime: number, W: number, H: number) {
  const t = clip.text
  if (!t) return
  const weight = t.bold ? '700' : '400'
  const style = t.italic ? 'italic' : 'normal'
  ctx.font = `${style} ${weight} ${t.fontSize}px ${t.fontFamily}, Inter, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = t.align
  // Letter spacing (supported in modern canvas; ignored gracefully otherwise).
  ctx.letterSpacing = `${t.letterSpacing ?? 0}px`

  // Reveal fraction: animated over time when typewriter is on, else the static `reveal`.
  let revealFrac = t.reveal ?? 1
  if (t.typewriter) {
    revealFrac = Math.max(0, Math.min(1, (localTime * TYPEWRITER_CPS) / Math.max(1, t.content.length)))
  }
  let content = t.content
  if (revealFrac < 1) {
    content = t.content.slice(0, Math.max(0, Math.floor(t.content.length * revealFrac)))
  }

  const lines = content.split('\n')
  const lineHeight = t.fontSize * (t.lineHeight ?? 1.2)
  const cx = t.x * W
  const cy = t.y * H
  const totalH = lineHeight * lines.length
  const startY = cy - totalH / 2 + lineHeight / 2

  if (t.background) {
    let maxW = 0
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width)
    const padX = t.bgPadding ?? t.fontSize * 0.3
    const padY = t.bgPadding ?? t.fontSize * 0.2
    let bx = cx - padX
    if (t.align === 'center') bx = cx - maxW / 2 - padX
    else if (t.align === 'right') bx = cx - maxW - padX
    ctx.fillStyle = t.background
    const bw = maxW + padX * 2
    const bh = totalH + padY * 2
    const by = startY - lineHeight / 2 - padY
    const radius = Math.min(t.bgRadius ?? 0, bw / 2, bh / 2)
    if (radius > 0 && typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, radius)
      ctx.fill()
    } else {
      ctx.fillRect(bx, by, bw, bh)
    }
  }

  // Drop shadow (applies to the fill/stroke below).
  if (t.shadowColor && (t.shadowBlur || t.shadowOffsetX || t.shadowOffsetY)) {
    ctx.shadowColor = t.shadowColor
    ctx.shadowBlur = t.shadowBlur ?? 0
    ctx.shadowOffsetX = t.shadowOffsetX ?? 0
    ctx.shadowOffsetY = t.shadowOffsetY ?? 0
  }

  // Outline stroke under the fill.
  if (t.strokeColor && (t.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = t.strokeColor
    ctx.lineWidth = t.strokeWidth!
    ctx.lineJoin = 'round'
    lines.forEach((line, i) => ctx.strokeText(line, cx, startY + i * lineHeight))
    // Don't let the shadow double-draw under the fill.
    ctx.shadowColor = 'transparent'
  }

  ctx.fillStyle = t.color
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineHeight)
  })
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  time: number,
  sources: RenderSources,
) {
  const W = project.width
  const H = project.height
  ctx.fillStyle = project.background || '#000000'
  ctx.fillRect(0, 0, W, H)

  // Visual media (video/image) first, in track order so later tracks layer on top.
  for (const track of project.tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      if (!clipActiveAt(clip, time)) continue
      if (clip.type === 'video') {
        const el = sources.getVideo(clip.id)
        if (el && el.readyState >= 2 && el.videoWidth) {
          const box = fitBox(clip, el.videoWidth, el.videoHeight, W, H)
          compositeMedia(ctx, clip, el, el.videoWidth, el.videoHeight, box, time, W, H)
        }
      } else if (clip.type === 'image' && clip.mediaId) {
        const el = sources.getImage(clip.mediaId)
        if (el && el.complete && el.naturalWidth) {
          const box = fitBox(clip, el.naturalWidth, el.naturalHeight, W, H)
          compositeMedia(ctx, clip, el, el.naturalWidth, el.naturalHeight, box, time, W, H)
        }
      } else if (clip.type === 'shape' && clip.shape) {
        ctx.save()
        applyClipTransform(ctx, clip, time, W, H)
        applyTransition(ctx, transitionModifier(clip, time), W, H)
        ctx.globalCompositeOperation = blendOp(clip.blend)
        drawShape(ctx, clip.shape, W, H)
        ctx.restore()
      }
    }
  }

  // Text always renders on top.
  for (const track of project.tracks) {
    if (track.type !== 'text') continue
    for (const clip of track.clips) {
      if (clip.type === 'text' && clipActiveAt(clip, time)) {
        ctx.save()
        applyClipTransform(ctx, clip, time, W, H)
        applyTransition(ctx, transitionModifier(clip, time), W, H)
        drawText(ctx, clip, time - clip.start, W, H)
        ctx.restore()
      }
    }
  }
}
