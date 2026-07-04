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

interface AlbumTimelineItem {
  trackNo: number
  title: string
  songId?: string
  takeId?: string
  startSec: number
  durationSec: number
  audioPath?: string | null
  lyricsPath?: string | null
  descriptionPath?: string | null
  thumbnailPromptPath?: string | null
  existingVideoPath?: string | null
  fallbackVisual?: string | null
  captionMode?: string | null
}

interface AlbumBundle {
  iriePromo: 2
  source: 'pam'
  kind: 'youtube_album_release'
  manualOnly?: boolean
  title?: string
  artist?: string
  albumTitle?: string
  timeline?: AlbumTimelineItem[]
  chapters?: { at: number; label: string }[]
}

export type PamAlbumVisualPreset = 'album-card' | 'lyric-video' | 'visualizer' | 'cinematic'
export type PamAlbumCaptionStrategy = 'auto' | 'lyrics' | 'titles-only' | 'none'
export type PamAlbumExportTarget = 'youtube-16x9' | 'shorts-9x16' | 'square-1x1'
export type PamAlbumPrepAction = 'enhance' | 'denoise' | 'stabilize' | 'optical-flow'

export interface PamAlbumBuildOptions {
  visualPreset?: PamAlbumVisualPreset
  captionStrategy?: PamAlbumCaptionStrategy
  exportTargets?: PamAlbumExportTarget[]
  prepActions?: PamAlbumPrepAction[]
  assetOverrides?: Record<string, {
    audioFile?: File
    videoFile?: File
    lyricsFile?: File
  }>
}

export interface PamAlbumPreflightTrack {
  key: string
  trackNo: number
  title: string
  startSec: number
  durationSec: number
  audioFound: boolean
  videoFound: boolean
  lyricsFound: boolean
  captionCount: number
  fallbackVisual?: string | null
  captionMode?: string | null
  missing: ('audio' | 'video' | 'lyrics')[]
}

export interface PamAlbumPreflight {
  packetPath: string
  baseDir: string
  title: string
  artist?: string
  albumTitle?: string
  durationSec: number
  trackCount: number
  chapterCount: number
  tracks: PamAlbumPreflightTrack[]
  totals: {
    audioFound: number
    videoFound: number
    lyricsFound: number
    captions: number
    missingAudio: number
    missingVideo: number
    missingLyrics: number
  }
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
}

function dirname(p: string): string {
  const n = normalizePath(p)
  const i = n.lastIndexOf('/')
  return i >= 0 ? n.slice(0, i) : ''
}

export function resolveRelativePath(baseDir: string, rel: string): string {
  const parts = [...normalizePath(baseDir).split('/'), ...normalizePath(rel).split('/')].filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

function filePath(file: File): string {
  return normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
}

function fileMap(files: File[]): Map<string, File> {
  const map = new Map<string, File>()
  for (const file of files) {
    const path = filePath(file)
    map.set(path, file)
    map.set(file.name, file)
  }
  return map
}

function findByPath(map: Map<string, File>, baseDir: string, rel: string | null | undefined): File | null {
  if (!rel) return null
  const resolved = resolveRelativePath(baseDir, rel)
  const exact = map.get(resolved)
  if (exact) return exact
  const suffix = normalizePath(rel).replace(/^(\.\.\/)+/, '')
  const basename = suffix.split('/').pop() ?? ''
  for (const [path, file] of map) {
    if (path.endsWith(`/${suffix}`) || path === suffix || (basename && file.name === basename)) return file
  }
  return map.get(suffix) ?? map.get(basename) ?? null
}

function isAlbumBundle(value: unknown): value is AlbumBundle {
  const b = value as Partial<AlbumBundle> | null
  return !!b && b.iriePromo === 2 && b.kind === 'youtube_album_release' && b.source === 'pam'
}

async function readAlbumBundle(input: FileList | File[]) {
  const files = Array.from(input)
  let packetFile: File | null = null
  let packetPath = ''
  let bundle: AlbumBundle | null = null

  for (const file of files.filter((f) => f.name.endsWith('.json'))) {
    try {
      const parsed = JSON.parse(await file.text())
      if (isAlbumBundle(parsed)) {
        packetFile = file
        packetPath = filePath(file)
        bundle = parsed
        break
      }
    } catch {
      /* keep scanning */
    }
  }

  if (!packetFile || !bundle) {
    throw new Error('Choose the YouTube Album Release folder or its handoffs/irie_cut_album.iriepromo.json packet.')
  }

  return { files, entries: fileMap(files), packetPath, baseDir: dirname(packetPath), bundle }
}

async function probeFile(file: File, type: MediaAsset['type']) {
  try {
    return await probeMedia(file, type)
  } catch {
    return { duration: 0, width: 0, height: 0, thumbnail: undefined }
  }
}

function mimeType(file: File, fallback: string): string {
  return file.type || fallback
}

function trackTitle(track: AlbumTimelineItem): string {
  return `${track.trackNo ? `${track.trackNo}. ` : ''}${track.title || 'Untitled track'}`
}

function trackKey(track: AlbumTimelineItem): string {
  return String(track.trackNo || track.title || track.startSec)
}

function parseLyricCaptions(text: string, track: AlbumTimelineItem): { start: number; end: number; text: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const timed: { start: number; text: string }[] = []
  const re = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]\s*(.+)$/
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    const min = Number(m[1])
    const sec = Number(m[2])
    const ms = Number(`0.${m[3] ?? '0'}`)
    timed.push({ start: track.startSec + min * 60 + sec + ms, text: m[4].trim() })
  }
  if (timed.length) {
    return timed.map((cue, i) => ({
      start: cue.start,
      end: timed[i + 1]?.start ?? track.startSec + track.durationSec,
      text: cue.text,
    })).filter((cue) => cue.text && cue.end > cue.start)
  }

  const usable = lines.filter((line) => !/^(\[.*]|\(|\{)/.test(line)).slice(0, 80)
  if (!usable.length) return []
  const slot = track.durationSec / usable.length
  return usable.map((line, i) => ({
    start: track.startSec + i * slot,
    end: track.startSec + Math.min(track.durationSec, (i + 1) * slot),
    text: line,
  })).filter((cue) => cue.end - cue.start >= 0.4)
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

export async function analyzePamAlbumImport(input: FileList | File[]): Promise<PamAlbumPreflight> {
  const { entries, packetPath, baseDir, bundle } = await readAlbumBundle(input)
  const tracks = (bundle.timeline ?? []).slice().sort((a, b) => (a.trackNo || 0) - (b.trackNo || 0))
  if (!tracks.length) throw new Error('Album packet has no timeline tracks.')

  const rows: PamAlbumPreflightTrack[] = []
  for (const track of tracks) {
    const audioFile = findByPath(entries, baseDir, track.audioPath)
    const videoFile = findByPath(entries, baseDir, track.existingVideoPath)
    const lyricsFile = findByPath(entries, baseDir, track.lyricsPath)
    let captionCount = 0
    if (lyricsFile && track.captionMode !== 'none') {
      captionCount = parseLyricCaptions(await lyricsFile.text(), track).length
    }

    const missing: PamAlbumPreflightTrack['missing'] = []
    if (track.audioPath && !audioFile) missing.push('audio')
    if (track.existingVideoPath && !videoFile) missing.push('video')
    if (track.lyricsPath && !lyricsFile) missing.push('lyrics')

    rows.push({
      key: trackKey(track),
      trackNo: track.trackNo,
      title: track.title || 'Untitled track',
      startSec: Math.max(0, track.startSec || 0),
      durationSec: Math.max(1, track.durationSec || 1),
      audioFound: !!audioFile,
      videoFound: !!videoFile,
      lyricsFound: !!lyricsFile,
      captionCount,
      fallbackVisual: track.fallbackVisual,
      captionMode: track.captionMode,
      missing,
    })
  }

  const durationSec = rows.reduce((max, track) => Math.max(max, track.startSec + track.durationSec), 0)
  return {
    packetPath,
    baseDir,
    title: bundle.title || bundle.albumTitle || 'Pam album',
    artist: bundle.artist,
    albumTitle: bundle.albumTitle,
    durationSec,
    trackCount: rows.length,
    chapterCount: bundle.chapters?.length ?? rows.length,
    tracks: rows,
    totals: {
      audioFound: rows.filter((t) => t.audioFound).length,
      videoFound: rows.filter((t) => t.videoFound).length,
      lyricsFound: rows.filter((t) => t.lyricsFound).length,
      captions: rows.reduce((sum, t) => sum + t.captionCount, 0),
      missingAudio: rows.filter((t) => t.missing.includes('audio')).length,
      missingVideo: rows.filter((t) => t.missing.includes('video')).length,
      missingLyrics: rows.filter((t) => t.missing.includes('lyrics')).length,
    },
  }
}

function fallbackFill(preset: PamAlbumVisualPreset): string {
  if (preset === 'lyric-video') return '#0b0b12'
  if (preset === 'visualizer') return '#020617'
  if (preset === 'cinematic') return '#101010'
  return '#050505'
}

function titleY(preset: PamAlbumVisualPreset): number {
  if (preset === 'lyric-video') return 0.34
  if (preset === 'visualizer') return 0.38
  return 0.42
}

function shouldCreateLyrics(strategy: PamAlbumCaptionStrategy, captionMode?: string | null): boolean {
  if (strategy === 'none' || strategy === 'titles-only') return false
  return captionMode !== 'none'
}

export async function buildPamAlbumProject(input: FileList | File[], options: PamAlbumBuildOptions = {}): Promise<string> {
  const { entries, baseDir, bundle } = await readAlbumBundle(input)
  const visualPreset = options.visualPreset ?? 'album-card'
  const captionStrategy = options.captionStrategy ?? 'auto'
  const exportTargets = options.exportTargets?.length ? options.exportTargets : ['youtube-16x9']
  const prepActions = options.prepActions ?? []

  const now = Date.now()
  const projectId = uid()
  const width = 1920
  const height = 1080
  const fps = 30
  const textTrackId = uid()
  const videoTrackId = uid()
  const audioTrackId = uid()
  const tracks = (bundle.timeline ?? []).slice().sort((a, b) => (a.trackNo || 0) - (b.trackNo || 0))
  if (!tracks.length) throw new Error('Album packet has no timeline tracks.')

  const media: { asset: MediaAsset; blob: Blob }[] = []
  const textClips: Clip[] = []
  const videoClips: Clip[] = []
  const audioClips: Clip[] = []

  for (const track of tracks) {
    const start = Math.max(0, track.startSec || 0)
    const duration = Math.max(1, track.durationSec || 1)
    const title = trackTitle(track)
    const overrides = options.assetOverrides?.[trackKey(track)]

    videoClips.push({
      id: uid(),
      trackId: videoTrackId,
      type: 'shape',
      name: `${title} card`,
      start,
      duration,
      trimStart: 0,
      trimEnd: duration,
      volume: 1,
      shape: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1, fill: fallbackFill(visualPreset), strokeWidth: 0 },
    })
    textClips.push({
      id: uid(),
      trackId: textTrackId,
      type: 'text',
      name: `${title} title`,
      start,
      duration: Math.min(8, duration),
      trimStart: 0,
      trimEnd: Math.min(8, duration),
      volume: 1,
      keyframes: { opacity: [{ t: 0, value: 0 }, { t: 0.4, value: 1 }, { t: Math.min(7.4, duration), value: 1 }, { t: Math.min(8, duration), value: 0 }] },
      text: {
        content: `${bundle.albumTitle || bundle.title || 'Album'}\n${title}`,
        fontSize: Math.round(height * 0.07),
        color: '#f2ede4',
        fontFamily: 'Bebas Neue, sans-serif',
        x: 0.5,
        y: titleY(visualPreset),
        align: 'center',
        bold: true,
        italic: false,
        strokeColor: '#000000',
        strokeWidth: 4,
        shadowColor: '#000000',
        shadowBlur: 16,
        shadowOffsetY: 4,
        lineHeight: 1.05,
      },
    })

    const videoFile = overrides?.videoFile ?? findByPath(entries, baseDir, track.existingVideoPath)
    if (videoFile) {
      const probe = await probeFile(videoFile, 'video')
      const id = uid()
      const asset: MediaAsset = {
        id,
        projectId,
        name: videoFile.name,
        type: 'video',
        mimeType: mimeType(videoFile, 'video/mp4'),
        size: videoFile.size,
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        thumbnail: probe.thumbnail,
        createdAt: now,
      }
      media.push({ asset, blob: videoFile })
      videoClips.push({
        id: uid(),
        trackId: videoTrackId,
        type: 'video',
        name: title,
        mediaId: id,
        start,
        duration: Math.min(duration, probe.duration || duration),
        trimStart: 0,
        trimEnd: Math.min(duration, probe.duration || duration),
        volume: 0,
        fit: 'cover',
        fadeIn: 0.2,
        fadeOut: 0.4,
      })
    }

    const audioFile = overrides?.audioFile ?? findByPath(entries, baseDir, track.audioPath)
    if (audioFile) {
      const probe = await probeFile(audioFile, 'audio')
      const id = uid()
      const asset: MediaAsset = {
        id,
        projectId,
        name: audioFile.name,
        type: 'audio',
        mimeType: mimeType(audioFile, 'audio/mpeg'),
        size: audioFile.size,
        duration: probe.duration || duration,
        width: 0,
        height: 0,
        createdAt: now,
      }
      media.push({ asset, blob: audioFile })
      audioClips.push({
        id: uid(),
        trackId: audioTrackId,
        type: 'audio',
        name: title,
        mediaId: id,
        start,
        duration,
        trimStart: 0,
        trimEnd: probe.duration || duration,
        volume: 1,
        fadeOut: Math.min(1.5, duration * 0.08),
      })
    }

    const lyricsFile = overrides?.lyricsFile ?? findByPath(entries, baseDir, track.lyricsPath)
    if (lyricsFile && shouldCreateLyrics(captionStrategy, track.captionMode)) {
      const lyricText = await lyricsFile.text()
      for (const cue of parseLyricCaptions(lyricText, track)) {
        const cueDuration = Math.max(0.4, cue.end - cue.start)
        textClips.push({
          id: uid(),
          trackId: textTrackId,
          type: 'text',
          name: `${title} lyric`,
          start: cue.start,
          duration: cueDuration,
          trimStart: 0,
          trimEnd: cueDuration,
          volume: 1,
          text: {
            ...captionStyle(height),
            content: cue.text,
            fontSize: Math.round(height * 0.045),
            y: 0.82,
            background: '#000000',
            bgRadius: 10,
          },
        })
      }
    }
  }

  const project: Project = {
    id: projectId,
    name: `${bundle.title || bundle.albumTitle || 'Pam album'} — YouTube album`,
    createdAt: now,
    updatedAt: now,
    width,
    height,
    fps,
    background: '#000000',
    masterVolume: 1,
    markers: (bundle.chapters ?? tracks.map((t) => ({ at: t.startSec, label: trackTitle(t) }))).map((c) => ({
      id: uid(),
      time: Math.max(0, c.at || 0),
      label: c.label || 'Chapter',
    })),
    visualizer: { enabled: true, color: '#f2ede4', bassColor: '#ff5236', bassReactive: true, bassCenter: true, y: 0.9 },
    promo: {
      source: 'pam',
      title: bundle.title || bundle.albumTitle || 'Pam album',
      artist: bundle.artist,
      campaign: {
        teaserIdeas: [
          `Visual preset: ${visualPreset}`,
          `Caption strategy: ${captionStrategy}`,
          `Export targets: ${exportTargets.join(', ')}`,
          prepActions.length ? `Prep queue: ${prepActions.join(', ')}` : 'Prep queue: none selected',
        ],
        rolloutNotes: [
          'Imported from a Pam YouTube Album Release packet (iriePromo v2).',
          'Review missing media placeholders before export.',
          prepActions.length
            ? `Enhance/prep intents were captured for future processing: ${prepActions.join(', ')}.`
            : 'No enhance/prep actions were selected at import.',
        ].join(' '),
      },
    },
    workflow: { kind: 'youtube-album-release', source: 'pam' },
    tracks: [
      { id: textTrackId, type: 'text', name: 'Titles & Lyrics', muted: false, solo: false, volume: 1, clips: textClips },
      { id: videoTrackId, type: 'video', name: 'Album visuals', muted: false, solo: false, volume: 1, clips: videoClips },
      { id: audioTrackId, type: 'audio', name: 'Album audio', muted: false, solo: false, volume: 1, clips: audioClips },
    ],
  }

  await storage.saveProject(project)
  for (const m of media) await storage.saveMedia(m.asset, m.blob)
  return projectId
}
