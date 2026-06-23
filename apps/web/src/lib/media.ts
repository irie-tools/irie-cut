// Client-side helpers for probing uploaded files: detecting type, reading
// duration/dimensions, and generating poster thumbnails. All browser-only.

import type { MediaType } from '#/types/editor'

export function detectMediaType(mime: string): MediaType | null {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  return null
}

export interface ProbeResult {
  duration: number
  width: number
  height: number
  thumbnail?: string
}

function probeImage(url: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const thumbnail = makeThumbnail(img, img.naturalWidth, img.naturalHeight)
      resolve({ duration: 0, width: img.naturalWidth, height: img.naturalHeight, thumbnail })
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

function probeVideo(url: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    video.onloadedmetadata = () => {
      // Seek a little in to grab a representative, non-black frame.
      video.currentTime = Math.min(0.1, video.duration / 2 || 0)
    }
    video.onseeked = () => {
      const thumbnail = makeThumbnail(video, video.videoWidth, video.videoHeight)
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth,
        height: video.videoHeight,
        thumbnail,
      })
    }
    video.onerror = () => reject(new Error('Failed to load video'))
  })
}

function probeAudio(url: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = url
    audio.onloadedmetadata = () =>
      resolve({ duration: audio.duration || 0, width: 0, height: 0 })
    audio.onerror = () => reject(new Error('Failed to load audio'))
  })
}

function makeThumbnail(
  source: CanvasImageSource,
  w: number,
  h: number,
): string | undefined {
  if (!w || !h) return undefined
  const maxW = 320
  const scale = Math.min(1, maxW / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  try {
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch {
    return undefined
  }
}

export async function probeMedia(file: File, type: MediaType): Promise<ProbeResult> {
  const url = URL.createObjectURL(file)
  try {
    if (type === 'image') return await probeImage(url)
    if (type === 'video') return await probeVideo(url)
    return await probeAudio(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Format seconds as m:ss or h:mm:ss for compact UI labels. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Format seconds as m:ss.cs (centiseconds) for the timecode display. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds * 100) % 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs
    .toString()
    .padStart(2, '0')}`
}
