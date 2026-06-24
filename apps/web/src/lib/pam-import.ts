// Pam → Irie Cut promo import (Tier 1.1). Takes a `.iriepromo.json` bundle from
// Pam (the music studio) and assembles a ready-to-edit promo PROJECT: the LP
// cover as a slow Ken-Burns hero, the song on the audio track, and the synced
// lyric lines as styled caption clips. Mirrors lib/project-io (writes straight to
// storage, returns a projectId) so the editor opens onto a finished starting point.

import type { Clip, MediaAsset, Project, TextProperties, Track } from '#/types/editor'
import * as storage from '#/lib/storage'
import { probeMedia } from '#/lib/media'

export interface PamBundle {
  iriePromo: 1
  title: string
  artist?: string
  album?: string | null
  trackNo?: number | null
  durationSec: number
  persona?: string | null
  audio: string // data URL
  cover: string // data URL
  lyrics?: string
  lines?: { start: number; end: number; text: string }[]
  campaign?: NonNullable<Project['promo']>['campaign']
  stems?: Record<string, string> | null
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Default promo caption style: bold, lower-third, high-contrast (readable muted). */
function captionStyle(height: number): TextProperties {
  return {
    content: '',
    fontSize: Math.round(height * 0.05),
    color: '#ffffff',
    fontFamily: 'Bebas Neue, sans-serif',
    x: 0.5,
    y: 0.8,
    align: 'center',
    bold: true,
    italic: false,
    strokeColor: '#0b1220',
    strokeWidth: Math.max(2, Math.round(height * 0.004)),
    shadowColor: '#000000',
    shadowBlur: Math.round(height * 0.01),
    shadowOffsetY: 2,
    lineHeight: 1.05,
  }
}

/**
 * Build a promo project from a Pam bundle. Vertical 9:16 by default (the dominant
 * promo format); multi-size export re-frames to the rest. Returns the new id.
 */
export async function buildPromoProject(json: string): Promise<string> {
  const b = JSON.parse(json) as PamBundle
  if (!b || b.iriePromo !== 1 || !b.audio || !b.cover) {
    throw new Error('Not a valid Pam promo bundle (.iriepromo.json).')
  }
  const now = Date.now()
  const projectId = uid()
  const width = 1080
  const height = 1920
  const fps = 30

  const coverBlob = await dataUrlToBlob(b.cover)
  const audioBlob = await dataUrlToBlob(b.audio)
  const coverFile = new File([coverBlob], 'cover', { type: coverBlob.type || 'image/jpeg' })
  const audioFile = new File([audioBlob], b.title || 'song', { type: audioBlob.type || 'audio/mpeg' })

  let coverProbe: { duration: number; width: number; height: number; thumbnail?: string } = {
    duration: 0, width: 0, height: 0,
  }
  try {
    coverProbe = await probeMedia(coverFile, 'image')
  } catch {
    /* keep zeros */
  }
  let audioDuration = b.durationSec || 0
  try {
    const ap = await probeMedia(audioFile, 'audio')
    if (ap.duration) audioDuration = ap.duration
  } catch {
    /* fall back to bundle duration */
  }
  const duration = Math.max(0.5, audioDuration || b.durationSec || 10)

  const coverId = uid()
  const audioId = uid()
  const coverAsset: MediaAsset = {
    id: coverId, projectId, name: 'Cover', type: 'image', mimeType: coverBlob.type || 'image/jpeg',
    size: coverBlob.size, duration: 0, width: coverProbe.width, height: coverProbe.height,
    thumbnail: coverProbe.thumbnail, createdAt: now,
  }
  const audioAsset: MediaAsset = {
    id: audioId, projectId, name: b.title || 'Song', type: 'audio', mimeType: audioBlob.type || 'audio/mpeg',
    size: audioBlob.size, duration, width: 0, height: 0, createdAt: now,
  }

  const textTrackId = uid()
  const videoTrackId = uid()
  const audioTrackId = uid()

  // Cover hero with a slow Ken-Burns push + drift (the Phase 1/6 keyframe engine).
  const coverClip: Clip = {
    id: uid(), trackId: videoTrackId, type: 'image', name: 'Cover', mediaId: coverId,
    start: 0, duration, trimStart: 0, trimEnd: duration, volume: 1, fit: 'cover',
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    keyframes: {
      scale: [{ t: 0, value: 1, ease: 'inout' }, { t: duration, value: 1.12 }],
      x: [{ t: 0, value: 0, ease: 'inout' }, { t: duration, value: 0.04 }],
    },
  }

  const audioClip: Clip = {
    id: uid(), trackId: audioTrackId, type: 'audio', name: b.title || 'Song', mediaId: audioId,
    start: 0, duration, trimStart: 0, trimEnd: duration, volume: 1, fadeOut: Math.min(1.5, duration * 0.1),
  }

  const baseCaption = captionStyle(height)
  const captionClips: Clip[] = (b.lines ?? [])
    .filter((l) => l && l.text && l.text.trim())
    .map((l) => {
      const start = Math.max(0, l.start)
      const dur = Math.max(0.4, (l.end ?? start + 2) - l.start)
      return {
        id: uid(), trackId: textTrackId, type: 'text' as const, name: 'Caption',
        start, duration: dur, trimStart: 0, trimEnd: dur, volume: 1,
        // a gentle fade-in pop on each line
        keyframes: { opacity: [{ t: 0, value: 0 }, { t: Math.min(0.25, dur * 0.3), value: 1 }] },
        text: { ...baseCaption, content: l.text.trim() },
      }
    })

  const tracks: Track[] = [
    { id: textTrackId, type: 'text', name: 'Captions', muted: false, solo: false, volume: 1, clips: captionClips },
    { id: videoTrackId, type: 'video', name: 'Cover', muted: false, solo: false, volume: 1, clips: [coverClip] },
    { id: audioTrackId, type: 'audio', name: 'Song', muted: false, solo: false, volume: 1, clips: [audioClip] },
  ]

  const project: Project = {
    id: projectId,
    name: `${b.title || 'Song'} — promo`,
    createdAt: now, updatedAt: now,
    width, height, fps, background: '#000000', masterVolume: 1, markers: [],
    promo: { source: 'pam', title: b.title, artist: b.artist, campaign: b.campaign ?? null },
    tracks,
  }

  await storage.saveProject(project)
  await storage.saveMedia(coverAsset, coverBlob)
  await storage.saveMedia(audioAsset, audioBlob)
  return projectId
}
