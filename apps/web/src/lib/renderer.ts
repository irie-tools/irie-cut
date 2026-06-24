// Pure frame renderer: given a project, a time, and a way to resolve the
// drawable element for each clip, paint one frame into a 2D canvas context.
// Coordinates are in project pixel space (canvas backing-store size).

import type { Clip, Project } from '#/types/editor'
import { filterCss } from '#/lib/filters'
import { transitionModifier, type TransitionModifier } from '#/lib/transitions'

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

/** Apply a transition modifier to the context. Caller must ctx.save() first. */
function applyTransition(ctx: CanvasRenderingContext2D, m: TransitionModifier, W: number, H: number) {
  ctx.globalAlpha *= m.alpha
  if (m.dx || m.dy) ctx.translate(m.dx * W, m.dy * H)
  if (m.scale !== 1) {
    ctx.translate(W / 2, H / 2)
    ctx.scale(m.scale, m.scale)
    ctx.translate(-W / 2, -H / 2)
  }
  if (m.clip) {
    ctx.beginPath()
    ctx.rect(m.clip.x * W, m.clip.y * H, m.clip.w * W, m.clip.h * H)
    ctx.clip()
  }
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, W: number, H: number) {
  const t = clip.text
  if (!t) return
  const weight = t.bold ? '700' : '400'
  const style = t.italic ? 'italic' : 'normal'
  ctx.font = `${style} ${weight} ${t.fontSize}px ${t.fontFamily}, Inter, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = t.align

  const lines = t.content.split('\n')
  const lineHeight = t.fontSize * 1.2
  const cx = t.x * W
  const cy = t.y * H
  const totalH = lineHeight * lines.length
  const startY = cy - totalH / 2 + lineHeight / 2

  if (t.background) {
    let maxW = 0
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width)
    const padX = t.fontSize * 0.3
    const padY = t.fontSize * 0.2
    let bx = cx - padX
    if (t.align === 'center') bx = cx - maxW / 2 - padX
    else if (t.align === 'right') bx = cx - maxW - padX
    ctx.fillStyle = t.background
    ctx.fillRect(bx, startY - lineHeight / 2 - padY, maxW + padX * 2, totalH + padY * 2)
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
          const box = containBox(el.videoWidth, el.videoHeight, W, H)
          ctx.save()
          applyTransition(ctx, transitionModifier(clip, time), W, H)
          ctx.filter = filterCss(clip.filter) || 'none'
          ctx.drawImage(el, box.x, box.y, box.w, box.h)
          ctx.restore()
        }
      } else if (clip.type === 'image' && clip.mediaId) {
        const el = sources.getImage(clip.mediaId)
        if (el && el.complete && el.naturalWidth) {
          const box = containBox(el.naturalWidth, el.naturalHeight, W, H)
          ctx.save()
          applyTransition(ctx, transitionModifier(clip, time), W, H)
          ctx.filter = filterCss(clip.filter) || 'none'
          ctx.drawImage(el, box.x, box.y, box.w, box.h)
          ctx.restore()
        }
      }
    }
  }

  // Text always renders on top.
  for (const track of project.tracks) {
    if (track.type !== 'text') continue
    for (const clip of track.clips) {
      if (clip.type === 'text' && clipActiveAt(clip, time)) {
        ctx.save()
        applyTransition(ctx, transitionModifier(clip, time), W, H)
        drawText(ctx, clip, W, H)
        ctx.restore()
      }
    }
  }
}
