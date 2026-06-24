// Pam → Irie Cut promo import (Tier 1.1). Takes a `.iriepromo.json` bundle from
// Pam (the music studio) and assembles a ready-to-edit promo PROJECT: the LP
// cover as a slow Ken-Burns hero, the song on the audio track, and the synced
// lyric lines as styled caption clips. Mirrors lib/project-io (writes straight to
// storage, returns a projectId) so the editor opens onto a finished starting point.

import type { Clip, MediaAsset, Project, TextProperties, Track } from '#/types/editor'
import { DEFAULT_STILL_DURATION } from '#/types/editor'
import * as storage from '#/lib/storage'
import { probeMedia } from '#/lib/media'
import { getBeats } from '#/lib/beat-detect'
import { planBeatCut, clipsFromSegments, sequentialClips, type BeatCutSource } from '#/lib/beat-cut'
import { motionKeyframes } from '#/lib/motion'

export interface PromoBundle {
  iriePromo: 1
  /** Provenance hint; if absent, inferred (clips-only ⇒ 'studio'). */
  source?: 'pam' | 'studio'
  title?: string
  artist?: string
  album?: string | null
  trackNo?: number | null
  durationSec?: number
  persona?: string | null
  audio?: string // data URL — optional music bed
  cover?: string // data URL — canonical LP cover / poster (Pam)
  /** Optional extra cover variations to beat-cut between (data URLs). */
  covers?: string[]
  /** Video clips as data URLs (Video Studio). */
  clips?: string[]
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
  const b = JSON.parse(json) as PromoBundle
  const imageUrls = b.covers && b.covers.length ? b.covers : b.cover ? [b.cover] : []
  const clipUrls = b.clips ?? []
  if (!b || b.iriePromo !== 1 || imageUrls.length + clipUrls.length === 0) {
    throw new Error('Not a valid Irie promo bundle (.iriepromo.json).')
  }
  const now = Date.now()
  const projectId = uid()
  const width = 1080
  const height = 1920
  const fps = 30

  // --- Audio (optional music bed) ---
  let audioId: string | null = null
  let audioBlob: Blob | null = null
  let audioDuration = 0
  if (b.audio) {
    audioBlob = await dataUrlToBlob(b.audio)
    const audioFile = new File([audioBlob], b.title || 'song', { type: audioBlob.type || 'audio/mpeg' })
    audioDuration = b.durationSec || 0
    try {
      const ap = await probeMedia(audioFile, 'audio')
      if (ap.duration) audioDuration = ap.duration
    } catch {
      /* fall back to durationSec */
    }
    audioId = uid()
  }

  // --- Visual sources: images first, then videos (each imported as media) ---
  interface SourceMedia {
    id: string
    asset: MediaAsset
    blob: Blob
    source: BeatCutSource
  }
  const media: SourceMedia[] = []
  for (let i = 0; i < imageUrls.length; i++) {
    const blob = await dataUrlToBlob(imageUrls[i])
    const file = new File([blob], `cover-${i}`, { type: blob.type || 'image/jpeg' })
    let probe: { duration: number; width: number; height: number; thumbnail?: string } = {
      duration: 0, width: 0, height: 0,
    }
    try {
      probe = await probeMedia(file, 'image')
    } catch {
      /* keep zeros */
    }
    const id = uid()
    media.push({
      id, blob, source: { mediaId: id, type: 'image' },
      asset: {
        id, projectId, name: i === 0 ? 'Cover' : `Cover ${i + 1}`, type: 'image',
        mimeType: blob.type || 'image/jpeg', size: blob.size, duration: 0,
        width: probe.width, height: probe.height, thumbnail: probe.thumbnail, createdAt: now,
      },
    })
  }
  for (let i = 0; i < clipUrls.length; i++) {
    const blob = await dataUrlToBlob(clipUrls[i])
    const file = new File([blob], `clip-${i}`, { type: blob.type || 'video/mp4' })
    let probe: { duration: number; width: number; height: number; thumbnail?: string } = {
      duration: 0, width: 0, height: 0,
    }
    try {
      probe = await probeMedia(file, 'video')
    } catch {
      /* keep zeros */
    }
    const id = uid()
    const dur = probe.duration || 0
    media.push({
      id, blob, source: { mediaId: id, type: 'video', sourceDuration: dur > 0 ? dur : undefined },
      asset: {
        id, projectId, name: `Clip ${i + 1}`, type: 'video',
        mimeType: blob.type || 'video/mp4', size: blob.size, duration: dur,
        width: probe.width, height: probe.height, thumbnail: probe.thumbnail, createdAt: now,
      },
    })
  }
  const sources = media.map((m) => m.source)

  // --- Project duration ---
  const videoTotal = media
    .filter((m) => m.source.type === 'video')
    .reduce((s, m) => s + (m.source.sourceDuration ?? 0), 0)
  const fallbackTotal = videoTotal > 0 ? videoTotal : imageUrls.length * DEFAULT_STILL_DURATION
  const duration = Math.max(0.5, audioDuration || fallbackTotal || 10)

  const textTrackId = uid()
  const videoTrackId = uid()
  const audioTrackId = uid()

  // --- Visuals track: hero (1 image) / beat-cut (song) / sequential (no song) ---
  let videoClips: Clip[]
  if (sources.length === 1 && sources[0].type === 'image') {
    // Single cover → a cinematic, multi-phase Ken-Burns that stays visibly in
    // motion across the whole song (not one imperceptible zoom over 3 minutes).
    videoClips = [
      {
        id: uid(), trackId: videoTrackId, type: 'image', name: 'Cover', mediaId: sources[0].mediaId,
        start: 0, duration, trimStart: 0, trimEnd: duration, volume: 1, fit: 'cover',
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        keyframes: motionKeyframes('cinematic', { duration }),
      },
    ]
  } else if (audioId && audioBlob) {
    let beats: number[] = []
    try {
      beats = await getBeats(audioId, audioBlob)
    } catch {
      /* no beats → planBeatCut even-splits */
    }
    const segments = planBeatCut({ beats, songDuration: duration, sourceCount: sources.length, k: 2 })
    videoClips = clipsFromSegments({ segments, sources, trackId: videoTrackId, makeId: uid })
  } else {
    videoClips = sequentialClips({ sources, trackId: videoTrackId, makeId: uid })
  }

  // --- Audio clip + asset (optional) ---
  const audioClip: Clip | null = audioId
    ? {
        id: uid(), trackId: audioTrackId, type: 'audio', name: b.title || 'Song', mediaId: audioId,
        start: 0, duration, trimStart: 0, trimEnd: duration, volume: 1, fadeOut: Math.min(1.5, duration * 0.1),
      }
    : null
  const audioAsset: MediaAsset | null =
    audioId && audioBlob
      ? {
          id: audioId, projectId, name: b.title || 'Song', type: 'audio',
          mimeType: audioBlob.type || 'audio/mpeg', size: audioBlob.size, duration, width: 0, height: 0, createdAt: now,
        }
      : null

  // --- Captions (optional) ---
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

  // --- Tracks (only those with content) ---
  const tracks: Track[] = []
  if (captionClips.length) {
    tracks.push({ id: textTrackId, type: 'text', name: 'Captions', muted: false, solo: false, volume: 1, clips: captionClips })
  }
  tracks.push({ id: videoTrackId, type: 'video', name: 'Visuals', muted: false, solo: false, volume: 1, clips: videoClips })
  if (audioClip) {
    tracks.push({ id: audioTrackId, type: 'audio', name: 'Song', muted: false, solo: false, volume: 1, clips: [audioClip] })
  }

  const source: 'pam' | 'studio' = b.source ?? (clipUrls.length && !imageUrls.length ? 'studio' : 'pam')

  const project: Project = {
    id: projectId,
    name: `${b.title || (source === 'studio' ? 'Studio promo' : 'Song')} — promo`,
    createdAt: now, updatedAt: now,
    width, height, fps, background: '#000000', masterVolume: 1, markers: [],
    // Music promos get the on-frame sound bar by default (off for no-audio bundles).
    visualizer: audioId
      ? { enabled: true, color: '#f2ede4', bassColor: '#ff5236', bassReactive: true, y: 0.9 }
      : undefined,
    promo: { source, title: b.title || '', artist: b.artist, campaign: b.campaign ?? null },
    tracks,
  }

  await storage.saveProject(project)
  for (const m of media) await storage.saveMedia(m.asset, m.blob)
  if (audioAsset && audioBlob) await storage.saveMedia(audioAsset, audioBlob)
  return projectId
}
