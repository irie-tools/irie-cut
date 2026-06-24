// Real-time timeline exporter. Replays the project into an offscreen canvas,
// captures it as a video stream, mixes clip audio through the Web Audio API,
// and records the combined stream with MediaRecorder. Export takes roughly as
// long as the video's duration.

import type { Project } from '#/types/editor'
import { drawFrame, clipActiveAt, type RenderSources } from '#/lib/renderer'
import { effectiveGain, anySolo } from '#/lib/audio'
import { projectDuration } from '#/stores/editor-store'

export interface ExportResult {
  blob: Blob
  extension: string
}

function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) return c
  }
  return { mimeType: '', extension: 'webm' }
}

interface AudioNodeBundle {
  el: HTMLMediaElement
  gain: GainNode
}

export async function exportProject(
  project: Project,
  getUrl: (mediaId: string) => string | undefined,
  onProgress: (fraction: number) => void,
): Promise<ExportResult> {
  const total = projectDuration(project)
  if (total <= 0) throw new Error('Nothing to export — the timeline is empty.')

  const fps = project.fps || 30
  const canvas = document.createElement('canvas')
  canvas.width = project.width
  canvas.height = project.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable.')

  // Audio graph.
  const AudioCtor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtor()
  const audioDest = audioCtx.createMediaStreamDestination()

  const videoEls = new Map<string, HTMLVideoElement>()
  const imageEls = new Map<string, HTMLImageElement>()
  const audioNodes = new Map<string, AudioNodeBundle>()

  // Pre-create all media elements and wire audio sources.
  const ready: Promise<unknown>[] = []
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'image' && clip.mediaId && !imageEls.has(clip.mediaId)) {
        const url = getUrl(clip.mediaId)
        if (url) {
          const img = new Image()
          img.src = url
          imageEls.set(clip.mediaId, img)
          ready.push(decodeImage(img))
        }
      } else if ((clip.type === 'video' || clip.type === 'audio') && clip.mediaId) {
        const url = getUrl(clip.mediaId)
        if (!url) continue
        const el = clip.type === 'video' ? document.createElement('video') : document.createElement('audio')
        el.src = url
        el.preload = 'auto'
        ;(el as HTMLVideoElement).playsInline = true
        el.crossOrigin = 'anonymous'
        if (clip.type === 'video') videoEls.set(clip.id, el as HTMLVideoElement)
        const srcNode = audioCtx.createMediaElementSource(el)
        const gain = audioCtx.createGain()
        gain.gain.value = 0
        srcNode.connect(gain).connect(audioDest)
        audioNodes.set(clip.id, { el, gain })
        ready.push(waitCanPlay(el))
      }
    }
  }
  await Promise.race([Promise.all(ready), delay(4000)])

  const sources: RenderSources = {
    getVideo: (id) => videoEls.get(id),
    getImage: (id) => imageEls.get(id),
  }

  const canvasStream = canvas.captureStream(fps)
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ])

  const { mimeType, extension } = pickMimeType()
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  await audioCtx.resume()

  return new Promise<ExportResult>((resolve, reject) => {
    let raf = 0
    let startWall = 0

    const cleanup = () => {
      cancelAnimationFrame(raf)
      videoEls.forEach((v) => v.pause())
      audioNodes.forEach((n) => n.el.pause())
      canvasStream.getTracks().forEach((t) => t.stop())
      void audioCtx.close()
    }

    recorder.onstop = () => {
      cleanup()
      resolve({ blob: new Blob(chunks, { type: mimeType || 'video/webm' }), extension })
    }
    recorder.onerror = () => {
      cleanup()
      reject(new Error('Recording failed.'))
    }

    const frame = (now: number) => {
      if (!startWall) startWall = now
      const t = (now - startWall) / 1000
      if (t >= total) {
        drawFrame(ctx, project, total - 0.001, sources)
        // Flush a final moment then stop.
        for (const { gain } of audioNodes.values()) gain.gain.value = 0
        setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 120)
        return
      }
      syncExport(project, t, sources, audioNodes)
      drawFrame(ctx, project, t, sources)
      onProgress(Math.min(1, t / total))
      raf = requestAnimationFrame(frame)
    }

    try {
      recorder.start()
      raf = requestAnimationFrame(frame)
    } catch (err) {
      cleanup()
      reject(err instanceof Error ? err : new Error('Failed to start export.'))
    }
  })
}

function syncExport(
  project: Project,
  t: number,
  sources: RenderSources,
  audioNodes: Map<string, AudioNodeBundle>,
) {
  const soloActive = anySolo(project)
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      const bundle = audioNodes.get(clip.id)
      const videoEl = sources.getVideo(clip.id)
      const el = bundle?.el ?? videoEl
      if (!el) continue
      const active = clipActiveAt(clip, t)
      const target = clip.trimStart + (t - clip.start)
      if (active) {
        if (el.paused) {
          if (Number.isFinite(target)) trySeek(el, target)
          void el.play().catch(() => {})
        } else if (Math.abs(el.currentTime - target) > 0.3 && Number.isFinite(target)) {
          trySeek(el, target)
        }
        if (bundle) bundle.gain.gain.value = effectiveGain(project, track, clip, t, soloActive)
      } else {
        if (!el.paused) el.pause()
        if (bundle) bundle.gain.gain.value = 0
      }
    }
  }
}

function trySeek(el: HTMLMediaElement, t: number) {
  try {
    el.currentTime = t
  } catch {
    /* not seekable yet */
  }
}

function decodeImage(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete) return resolve()
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
}

function waitCanPlay(el: HTMLMediaElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 3) return resolve()
    const done = () => {
      el.removeEventListener('canplay', done)
      resolve()
    }
    el.addEventListener('canplay', done)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
