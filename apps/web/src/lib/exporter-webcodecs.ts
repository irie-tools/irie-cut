// Frame-accurate WebCodecs exporter (Phase 5.1). Unlike the realtime
// MediaRecorder path, this renders each frame deterministically (seek → draw →
// encode), so the output is exact and can run faster than realtime. Audio is
// mixed offline through the SAME effectiveGain + buildFxChain seams as preview,
// then AAC-encoded and muxed into MP4.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { Project } from '#/types/editor'
import { drawFrame, clipActiveAt, type RenderSources } from '#/lib/renderer'
import { effectiveGain, anySolo } from '#/lib/audio'
import { buildFxChain, isNeutralFx } from '#/lib/audio-fx'
import { projectDuration } from '#/stores/editor-store'

export interface WebCodecsResult {
  blob: Blob
  extension: 'mp4'
}

export function webCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof OfflineAudioContext !== 'undefined'
  )
}

const VIDEO_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e01e', 'avc1.42001f']

async function pickVideoCodec(width: number, height: number, bitrate: number, fps: number): Promise<string | null> {
  for (const codec of VIDEO_CODECS) {
    try {
      const res = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: fps })
      if (res.supported) return codec
    } catch {
      /* try next */
    }
  }
  return null
}

function seekTo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (!Number.isFinite(t) || Math.abs(el.currentTime - t) < 1e-3) return resolve()
    const onSeeked = () => {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
    el.addEventListener('seeked', onSeeked)
    try {
      el.currentTime = t
    } catch {
      el.removeEventListener('seeked', onSeeked)
      resolve()
    }
  })
}

function decodeImage(img: HTMLImageElement): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete) return resolve()
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    const onReady = () => {
      v.removeEventListener('loadeddata', onReady)
      resolve(v)
    }
    v.addEventListener('loadeddata', onReady)
    v.addEventListener('error', () => reject(new Error('video load failed')))
  })
}

export interface WebCodecsOptions {
  bitrate?: number
  fps?: number
}

export async function exportProjectWebCodecs(
  project: Project,
  getUrl: (mediaId: string) => string | undefined,
  getBlob: (mediaId: string) => Promise<Blob | undefined>,
  onProgress: (fraction: number) => void,
  opts: WebCodecsOptions = {},
): Promise<WebCodecsResult> {
  const total = projectDuration(project)
  if (total <= 0) throw new Error('Nothing to export — the timeline is empty.')

  const fps = opts.fps ?? project.fps ?? 30
  const width = project.width
  const height = project.height
  const bitrate = opts.bitrate ?? Math.round((width * height * fps) / 50) // ~ quality target
  const totalFrames = Math.max(1, Math.ceil(total * fps))

  const codec = await pickVideoCodec(width, height, bitrate, fps)
  if (!codec) throw new Error('No supported H.264 encoder configuration.')

  const hasAudio = project.tracks.some((t) => t.clips.some((c) => (c.type === 'audio' || c.type === 'video') && c.mediaId))
  const audioSampleRate = 48000

  // --- Muxer ---
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    ...(hasAudio ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: audioSampleRate } } : {}),
    fastStart: 'in-memory',
  })

  // --- Video encode ---
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: (e) => {
      throw e
    },
  })
  videoEncoder.configure({ codec, width, height, bitrate, framerate: fps })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Pre-load media elements.
  const videoEls = new Map<string, HTMLVideoElement>()
  const imageEls = new Map<string, HTMLImageElement>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'video' && clip.mediaId && !videoEls.has(clip.id)) {
        const url = getUrl(clip.mediaId)
        if (url) {
          try {
            videoEls.set(clip.id, await loadVideo(url))
          } catch {
            /* skip */
          }
        }
      } else if (clip.type === 'image' && clip.mediaId && !imageEls.has(clip.mediaId)) {
        const url = getUrl(clip.mediaId)
        if (url) {
          const img = new Image()
          img.src = url
          imageEls.set(clip.mediaId, img)
          await decodeImage(img)
        }
      }
    }
  }
  const sources: RenderSources = {
    getVideo: (id) => videoEls.get(id),
    getImage: (id) => imageEls.get(id),
  }

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))])
  }

  for (let i = 0; i < totalFrames; i++) {
    const t = Math.min(total - 1e-4, i / fps)
    // Seek active video clips to the exact source time.
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.type !== 'video' || !clipActiveAt(clip, t)) continue
        const el = videoEls.get(clip.id)
        if (el) {
          const speed = clip.speed ?? 1
          await seekTo(el, clip.trimStart + (t - clip.start) * speed)
        }
      }
    }
    drawFrame(ctx, project, t, sources)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1e6) / fps),
      duration: Math.round(1e6 / fps),
    })
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
    frame.close()
    if (videoEncoder.encodeQueueSize > 8) {
      await new Promise<void>((r) => {
        const check = () => (videoEncoder.encodeQueueSize <= 4 ? r() : setTimeout(check, 4))
        check()
      })
    }
    onProgress(Math.min(0.95, (i / totalFrames) * (hasAudio ? 0.8 : 1)))
  }
  await videoEncoder.flush()

  // --- Audio ---
  if (hasAudio) {
    try {
      await mixAndEncodeAudio(project, getBlob, muxer, audioSampleRate, total)
    } catch {
      /* video-only fallback: still produce a valid file */
    }
  }
  onProgress(0.99)

  muxer.finalize()
  const buffer = (muxer.target as ArrayBufferTarget).buffer
  return { blob: new Blob([buffer], { type: 'video/mp4' }), extension: 'mp4' }
}

async function mixAndEncodeAudio(
  project: Project,
  getBlob: (mediaId: string) => Promise<Blob | undefined>,
  muxer: Muxer<ArrayBufferTarget>,
  sampleRate: number,
  total: number,
) {
  const length = Math.ceil(total * sampleRate)
  const octx = new OfflineAudioContext(2, length, sampleRate)
  const soloActive = anySolo(project)

  const decoded = new Map<string, AudioBuffer>()
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if ((clip.type !== 'audio' && clip.type !== 'video') || !clip.mediaId) continue
      let buffer = decoded.get(clip.mediaId)
      if (!buffer) {
        const blob = await getBlob(clip.mediaId)
        if (!blob) continue
        try {
          buffer = await octx.decodeAudioData(await blob.arrayBuffer())
        } catch {
          continue
        }
        decoded.set(clip.mediaId, buffer)
      }
      const speed = clip.speed ?? 1
      const src = octx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = speed

      const gain = octx.createGain()
      // Gain envelope: sample the shared effectiveGain across the clip span.
      const steps = Math.max(2, Math.ceil(clip.duration * 60))
      const curve = new Float32Array(steps)
      for (let k = 0; k < steps; k++) {
        const tt = clip.start + (k / (steps - 1)) * clip.duration
        curve[k] = effectiveGain(project, track, clip, tt, soloActive)
      }
      try {
        gain.gain.setValueCurveAtTime(curve, clip.start, Math.max(0.001, clip.duration))
      } catch {
        gain.gain.value = curve[0]
      }

      const fx = clip.audioFx
      if (fx && !isNeutralFx(fx)) {
        const chain = buildFxChain(octx, fx)
        src.connect(chain.input)
        chain.output.connect(gain)
      } else {
        src.connect(gain)
      }
      gain.connect(octx.destination)
      src.start(clip.start, clip.trimStart)
      src.stop(clip.start + clip.duration)
    }
  }

  const rendered = await octx.startRendering()

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
    error: () => {},
  })
  audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 2, bitrate: 192000 })

  const ch0 = rendered.getChannelData(0)
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : ch0
  const block = 4096
  for (let off = 0; off < rendered.length; off += block) {
    const n = Math.min(block, rendered.length - off)
    const planar = new Float32Array(n * 2)
    planar.set(ch0.subarray(off, off + n), 0)
    planar.set(ch1.subarray(off, off + n), n)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((off / sampleRate) * 1e6),
      data: planar,
    })
    audioEncoder.encode(audioData)
    audioData.close()
  }
  await audioEncoder.flush()
}
