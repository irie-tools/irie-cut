// The editor store: the single source of truth for the loaded project, its
// media, and all ephemeral editing state (selection, playhead, zoom, playback).
// Mutations update the project in memory and schedule a debounced persist.

import { create } from 'zustand'
import type {
  Clip,
  ClipType,
  MediaAsset,
  Project,
  TextProperties,
  Track,
  TrackType,
} from '#/types/editor'
import { DEFAULT_STILL_DURATION, DEFAULT_SHAPES } from '#/types/editor'
import {
  upsertKeyframe,
  removeKeyframeAt,
  KEYFRAME_PROPS,
  type KeyframeProp,
  type Easing,
} from '#/lib/keyframes'
import * as storage from '#/lib/storage'
import { detectMediaType, probeMedia } from '#/lib/media'
import { getBeats } from '#/lib/beat-detect'
import { planBeatCut, clipsFromSegments, type BeatCutSource } from '#/lib/beat-cut'
import { motionKeyframes, type MotionPreset } from '#/lib/motion'
import { computeSpectrum, getSpectrum } from '#/lib/audio-spectrum'
import { CAPTION_STYLES } from '#/lib/caption-styles'
import { attachWordsToCaptions } from '#/lib/caption-words'
import type { Template } from '#/lib/templates'

export const PX_PER_SECOND_BASE = 50

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const DEFAULT_TEXT: TextProperties = {
  content: 'Your text',
  fontSize: 72,
  color: '#ffffff',
  fontFamily: 'Inter',
  x: 0.5,
  y: 0.5,
  align: 'center',
  bold: true,
  italic: false,
}

export function projectDuration(project: Project | null): number {
  if (!project) return 0
  let max = 0
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      max = Math.max(max, clip.start + clip.duration)
    }
  }
  return max
}

interface EditorState {
  project: Project | null
  media: MediaAsset[]
  /** mediaId -> object URL, created on load. Not persisted. */
  mediaUrls: Record<string, string>
  selectedClipId: string | null
  /** All selected clip ids (includes the primary). For multi-select operations. */
  selectedClipIds: string[]
  /** Copy/paste clipboard of clip snapshots. */
  clipboard: Clip[] | null
  currentTime: number
  isPlaying: boolean
  /** Timeline zoom multiplier (pixels per second = base * zoom). */
  zoom: number
  loading: boolean
  importing: boolean

  /** Undo/redo history of project snapshots. */
  past: Project[]
  future: Project[]

  loadProject: (id: string) => Promise<void>
  closeProject: () => void
  updateProject: (patch: Partial<Project>, coalesceKey?: string) => void
  reframe: (width: number, height: number) => void
  undo: () => void
  redo: () => void

  importFiles: (files: FileList | File[]) => Promise<string[]>
  removeMedia: (id: string) => Promise<void>
  getMediaUrl: (mediaId: string) => string | undefined

  addTrack: (type: TrackType) => string
  updateTrack: (trackId: string, patch: Partial<Track>) => void
  removeTrack: (trackId: string) => void
  moveTrack: (trackId: string, dir: -1 | 1) => void
  addClipFromMedia: (mediaId: string, atTime?: number) => void
  addTextClip: (content?: string) => void
  addShapeClip: (kind: 'rect' | 'ellipse' | 'line' | 'arrow') => void
  addCaptions: (
    cues: { start: number; end: number; text: string }[],
    offset?: number,
    words?: { start: number; end: number; text: string }[],
  ) => void
  applyTemplate: (template: Template) => void
  updateClip: (clipId: string, patch: Partial<Clip>, coalesceKey?: string) => void
  setKeyframe: (
    clipId: string,
    prop: KeyframeProp,
    t: number,
    value: number,
    coalesceKey?: string,
  ) => void
  removeKeyframe: (clipId: string, prop: KeyframeProp, t: number) => void
  clearKeyframes: (clipId: string, prop?: KeyframeProp) => void
  setClipEasing: (clipId: string, ease: Easing) => void
  applyTextPreset: (clipId: string, preset: 'none' | 'fade' | 'pop' | 'slide' | 'typewriter') => void
  applyCaptionStyle: (trackId: string, styleId: string) => void
  setVolumeKeyframe: (clipId: string, t: number, value: number, coalesceKey?: string) => void
  removeVolumeKeyframe: (clipId: string, t: number) => void
  clearVolumeKeyframes: (clipId: string) => void
  moveClip: (clipId: string, trackId: string, start: number) => void
  splitAtPlayhead: () => void
  deleteClip: (clipId: string) => void
  rippleDeleteClip: (clipId: string) => void
  addMarker: (time: number) => void
  removeMarker: (id: string) => void
  clearMarkers: () => void
  detectBeats: (clipId: string) => Promise<number>
  pulseToBeats: (coverClipId: string) => Promise<number>
  applyMotion: (clipId: string, preset: MotionPreset) => Promise<void>
  setVisualizer: (patch: Partial<NonNullable<Project['visualizer']>>) => Promise<void>
  beatCutToBeats: (clipIds: string[], k?: number) => Promise<number>
  duplicateClip: (clipId: string) => void
  selectClip: (clipId: string | null, additive?: boolean) => void
  copySelection: () => void
  pasteClipboard: () => void
  nudgeSelection: (deltaSeconds: number) => void
  deleteSelection: () => void

  setCurrentTime: (t: number) => void
  setPlaying: (p: boolean) => void
  togglePlay: () => void
  setZoom: (z: number) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
const HISTORY_LIMIT = 60
let lastCoalesceKey: string | null = null
let lastMutateAt = 0

export const useEditorStore = create<EditorState>((set, get) => {
  function schedulePersist(next: Project) {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => void storage.saveProject(next), 400)
  }

  /**
   * Apply a transform to the project, push the previous state onto the undo
   * stack, and schedule a save. Consecutive mutations sharing a `coalesceKey`
   * within a short window collapse into one history entry (so a drag or a
   * slider sweep is a single undo, not hundreds).
   */
  function mutate(fn: (p: Project) => Project, coalesceKey?: string) {
    const current = get().project
    if (!current) return
    const next = { ...fn(current), updatedAt: Date.now() }
    const now = Date.now()
    const coalesce = coalesceKey != null && coalesceKey === lastCoalesceKey && now - lastMutateAt < 900
    lastCoalesceKey = coalesceKey ?? null
    lastMutateAt = now

    if (coalesce) {
      set({ project: next })
    } else {
      const past = [...get().past, current].slice(-HISTORY_LIMIT)
      set({ project: next, past, future: [] })
    }
    schedulePersist(next)
  }

  function findClip(p: Project, clipId: string): { track: Track; clip: Clip } | null {
    for (const track of p.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (clip) return { track, clip }
    }
    return null
  }

  /** Analyse the song for the sound-bar visualizer, then nudge a redraw. */
  async function ensureSpectrum() {
    const p = get().project
    if (!p?.visualizer?.enabled) return
    const song = p.tracks.flatMap((t) => t.clips).find((c) => c.type === 'audio' && c.mediaId)
    if (!song?.mediaId || getSpectrum(song.mediaId)) return
    const blob = await storage.getMediaBlob(song.mediaId)
    if (!blob) return
    try {
      await computeSpectrum(song.mediaId, blob)
    } catch {
      return
    }
    // Force the paused preview frame to repaint now the bars are available.
    set({ currentTime: get().currentTime + 0.0001 })
  }

  /** Pick (or lazily create) a track suitable for a given clip type. */
  function trackForType(p: Project, type: ClipType): { project: Project; trackId: string } {
    const wanted: TrackType = type === 'audio' ? 'audio' : type === 'text' ? 'text' : 'video'
    const existing = p.tracks.find((t) => t.type === wanted)
    if (existing) return { project: p, trackId: existing.id }
    const track: Track = { id: uid(), type: wanted, name: trackName(wanted), muted: false, clips: [] }
    return { project: { ...p, tracks: [...p.tracks, track] }, trackId: track.id }
  }

  return {
    project: null,
    media: [],
    mediaUrls: {},
    selectedClipId: null,
    selectedClipIds: [],
    clipboard: null,
    currentTime: 0,
    isPlaying: false,
    zoom: 1,
    loading: false,
    importing: false,
    past: [],
    future: [],

    async loadProject(id) {
      set({ loading: true })
      const project = await storage.getProject(id)
      if (!project) {
        set({ loading: false, project: null })
        return
      }
      const media = await storage.getProjectMedia(id)
      const mediaUrls: Record<string, string> = {}
      await Promise.all(
        media.map(async (m) => {
          const blob = await storage.getMediaBlob(m.id)
          if (blob) mediaUrls[m.id] = URL.createObjectURL(blob)
        }),
      )
      set({
        project,
        media,
        mediaUrls,
        loading: false,
        currentTime: 0,
        isPlaying: false,
        selectedClipId: null,
        selectedClipIds: [],
        past: [],
        future: [],
      })
      // Warm the visualizer spectrum so the bars appear without a manual nudge.
      void ensureSpectrum()
    },

    undo() {
      const { past, project } = get()
      if (!past.length || !project) return
      const prev = past[past.length - 1]
      set({ project: prev, past: past.slice(0, -1), future: [project, ...get().future].slice(0, HISTORY_LIMIT) })
      lastCoalesceKey = null
      schedulePersist(prev)
    },

    redo() {
      const { future, project } = get()
      if (!future.length || !project) return
      const nextProj = future[0]
      set({ project: nextProj, future: future.slice(1), past: [...get().past, project].slice(-HISTORY_LIMIT) })
      lastCoalesceKey = null
      schedulePersist(nextProj)
    },

    closeProject() {
      const { mediaUrls } = get()
      Object.values(mediaUrls).forEach((url) => URL.revokeObjectURL(url))
      set({ project: null, media: [], mediaUrls: {}, selectedClipId: null, selectedClipIds: [], currentTime: 0, isPlaying: false })
    },

    updateProject(patch, coalesceKey) {
      mutate((p) => ({ ...p, ...patch }), coalesceKey)
    },

    reframe(width, height) {
      // Switch the canvas aspect and set visual clips to cover the new frame.
      mutate((p) => ({
        ...p,
        width,
        height,
        tracks: p.tracks.map((t) => ({
          ...t,
          // Fill the new frame, but respect a clip's explicit fit choice.
          clips: t.clips.map((c) => (c.type === 'video' || c.type === 'image' ? { ...c, fit: c.fit ?? 'cover' } : c)),
        })),
      }))
    },

    async importFiles(files) {
      const project = get().project
      if (!project) return []
      set({ importing: true })
      const ids: string[] = []
      try {
        for (const file of Array.from(files)) {
          const type = detectMediaType(file.type)
          if (!type) continue
          let probe
          try {
            probe = await probeMedia(file, type)
          } catch {
            probe = { duration: 0, width: 0, height: 0 }
          }
          const asset: MediaAsset = {
            id: uid(),
            projectId: project.id,
            name: file.name,
            type,
            mimeType: file.type,
            size: file.size,
            duration: probe.duration,
            width: probe.width,
            height: probe.height,
            thumbnail: probe.thumbnail,
            createdAt: Date.now(),
          }
          await storage.saveMedia(asset, file)
          const url = URL.createObjectURL(file)
          set((s) => ({
            media: [...s.media, asset],
            mediaUrls: { ...s.mediaUrls, [asset.id]: url },
          }))
          ids.push(asset.id)
        }
      } finally {
        set({ importing: false })
      }
      return ids
    },

    async removeMedia(id) {
      await storage.deleteMedia(id)
      const url = get().mediaUrls[id]
      if (url) URL.revokeObjectURL(url)
      set((s) => {
        const mediaUrls = { ...s.mediaUrls }
        delete mediaUrls[id]
        return { media: s.media.filter((m) => m.id !== id), mediaUrls }
      })
      // Drop any clips referencing the deleted media.
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.mediaId !== id) })),
      }))
    },

    getMediaUrl(mediaId) {
      return get().mediaUrls[mediaId]
    },

    addTrack(type) {
      const id = uid()
      mutate((p) => ({
        ...p,
        tracks: [...p.tracks, { id, type, name: trackName(type), muted: false, solo: false, volume: 1, clips: [] }],
      }))
      return id
    },

    updateTrack(trackId, patch) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
      }))
    },

    removeTrack(trackId) {
      mutate((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }))
    },

    moveTrack(trackId, dir) {
      mutate((p) => {
        const i = p.tracks.findIndex((t) => t.id === trackId)
        const j = i + dir
        if (i < 0 || j < 0 || j >= p.tracks.length) return p
        const tracks = [...p.tracks]
        ;[tracks[i], tracks[j]] = [tracks[j], tracks[i]]
        return { ...p, tracks }
      })
    },

    addClipFromMedia(mediaId, atTime) {
      const state = get()
      const asset = state.media.find((m) => m.id === mediaId)
      if (!asset || !state.project) return
      const clipType: ClipType = asset.type
      const dur = asset.type === 'image' ? DEFAULT_STILL_DURATION : asset.duration || DEFAULT_STILL_DURATION
      mutate((p) => {
        const { project, trackId } = trackForType(p, clipType)
        const track = project.tracks.find((t) => t.id === trackId)!
        const start = atTime ?? endOfTrack(track)
        const clip: Clip = {
          id: uid(),
          trackId,
          type: clipType,
          name: asset.name,
          mediaId,
          start,
          duration: dur,
          trimStart: 0,
          trimEnd: asset.type === 'image' ? dur : asset.duration || dur,
          volume: 1,
        }
        return {
          ...project,
          tracks: project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        }
      })
    },

    addTextClip(content) {
      mutate((p) => {
        const { project, trackId } = trackForType(p, 'text')
        const clip: Clip = {
          id: uid(),
          trackId,
          type: 'text',
          name: 'Text',
          start: get().currentTime,
          duration: DEFAULT_STILL_DURATION,
          trimStart: 0,
          trimEnd: DEFAULT_STILL_DURATION,
          volume: 1,
          text: { ...DEFAULT_TEXT, content: content ?? DEFAULT_TEXT.content },
        }
        return {
          ...project,
          tracks: project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        }
      })
    },

    addShapeClip(kind) {
      mutate((p) => {
        const { project, trackId } = trackForType(p, 'shape')
        const clip: Clip = {
          id: uid(),
          trackId,
          type: 'shape',
          name: kind.charAt(0).toUpperCase() + kind.slice(1),
          start: get().currentTime,
          duration: DEFAULT_STILL_DURATION,
          trimStart: 0,
          trimEnd: DEFAULT_STILL_DURATION,
          volume: 1,
          shape: { ...DEFAULT_SHAPES[kind] },
        }
        return {
          ...project,
          tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
        }
      })
    },

    addCaptions(cues, offset = 0, words = []) {
      if (!cues.length) return
      mutate((p) => {
        const { project, trackId } = trackForType(p, 'text')
        const withWords = attachWordsToCaptions(cues, words)
        const clips: Clip[] = withWords.map((c) => {
          const start = Math.max(0, offset + c.start)
          const duration = Math.max(0.3, (c.end || c.start + 2) - c.start)
          return {
            id: uid(),
            trackId,
            type: 'text' as const,
            name: 'Caption',
            start,
            duration,
            trimStart: 0,
            trimEnd: duration,
            volume: 1,
            text: {
              ...DEFAULT_TEXT,
              content: c.text,
              fontSize: Math.round(project.height * 0.045),
              bold: true,
              y: 0.82,
              background: '#000000',
              karaoke: Boolean(c.words?.length),
              karaokeColor: '#22d3ee',
              words: c.words,
            },
          }
        })
        return {
          ...project,
          tracks: project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, ...clips] } : t,
          ),
        }
      })
    },

    applyTemplate(template) {
      mutate((p) => {
        const { project, trackId } = trackForType(p, 'text')
        const clips: Clip[] = template.texts.map((spec) => ({
          id: uid(),
          trackId,
          type: 'text',
          name: 'Text',
          start: spec.start,
          duration: spec.duration,
          trimStart: 0,
          trimEnd: spec.duration,
          volume: 1,
          text: {
            ...DEFAULT_TEXT,
            content: spec.content,
            fontSize: Math.round(template.height * spec.fontSizeRatio),
            x: spec.x,
            y: spec.y,
            align: spec.align,
            bold: spec.bold,
            background: spec.background,
          },
        }))
        return {
          ...project,
          width: template.width,
          height: template.height,
          background: template.background ?? project.background,
          visualizer: template.visualizer ?? project.visualizer,
          workflow: template.workflow ?? project.workflow,
          tracks: project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, ...clips] } : t,
          ),
        }
      })
    },

    updateClip(clipId, patch, coalesceKey) {
      mutate(
        (p) => ({
          ...p,
          tracks: p.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
          })),
        }),
        coalesceKey,
      )
    },

    setKeyframe(clipId, prop, t, value, coalesceKey) {
      mutate(
        (p) => ({
          ...p,
          tracks: p.tracks.map((tr) => ({
            ...tr,
            clips: tr.clips.map((c) => {
              if (c.id !== clipId) return c
              const keyframes = { ...(c.keyframes ?? {}) }
              keyframes[prop] = upsertKeyframe(keyframes[prop], t, value)
              return { ...c, keyframes }
            }),
          })),
        }),
        coalesceKey,
      )
    },

    removeKeyframe(clipId, prop, t) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== clipId || !c.keyframes?.[prop]) return c
            const keyframes = { ...c.keyframes }
            const left = removeKeyframeAt(keyframes[prop], t)
            if (left.length) keyframes[prop] = left
            else delete keyframes[prop]
            return { ...c, keyframes: Object.keys(keyframes).length ? keyframes : undefined }
          }),
        })),
      }))
    },

    clearKeyframes(clipId, prop) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== clipId) return c
            if (!prop) return { ...c, keyframes: undefined }
            if (!c.keyframes) return c
            const keyframes = { ...c.keyframes }
            delete keyframes[prop]
            return { ...c, keyframes: Object.keys(keyframes).length ? keyframes : undefined }
          }),
        })),
      }))
    },

    setVolumeKeyframe(clipId, t, value, coalesceKey) {
      mutate(
        (p) => ({
          ...p,
          tracks: p.tracks.map((tr) => ({
            ...tr,
            clips: tr.clips.map((c) =>
              c.id === clipId ? { ...c, volumeKeyframes: upsertKeyframe(c.volumeKeyframes, t, value) } : c,
            ),
          })),
        }),
        coalesceKey,
      )
    },

    removeVolumeKeyframe(clipId, t) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== clipId || !c.volumeKeyframes) return c
            const left = removeKeyframeAt(c.volumeKeyframes, t)
            return { ...c, volumeKeyframes: left.length ? left : undefined }
          }),
        })),
      }))
    },

    clearVolumeKeyframes(clipId) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => (c.id === clipId ? { ...c, volumeKeyframes: undefined } : c)),
        })),
      }))
    },

    setClipEasing(clipId, ease) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== clipId || !c.keyframes) return c
            const keyframes = { ...c.keyframes }
            for (const prop of KEYFRAME_PROPS) {
              const arr = keyframes[prop]
              if (arr) keyframes[prop] = arr.map((k) => ({ ...k, ease }))
            }
            return { ...c, keyframes }
          }),
        })),
      }))
    },

    applyCaptionStyle(trackId, styleId) {
      const style = CAPTION_STYLES.find((s) => s.id === styleId)
      if (!style) return
      mutate((p) => {
        const built = style.build(p.height)
        return {
          ...p,
          tracks: p.tracks.map((t) => {
            if (t.id !== trackId) return t
            return {
              ...t,
              clips: t.clips.map((c) => {
                if (c.type !== 'text' || !c.text) return c
                const text = { ...c.text, ...built.text }
                const D = c.duration
                let keyframes: Clip['keyframes']
                if (built.preset === 'pop') {
                  keyframes = {
                    scale: [{ t: 0, value: 0.7 }, { t: Math.min(0.18, D * 0.3), value: 1.08 }, { t: Math.min(0.34, D * 0.5), value: 1 }],
                    opacity: [{ t: 0, value: 0 }, { t: Math.min(0.14, D * 0.25), value: 1 }],
                  }
                } else if (built.preset === 'fade') {
                  keyframes = { opacity: [{ t: 0, value: 0 }, { t: Math.min(0.25, D * 0.3), value: 1 }] }
                } else {
                  keyframes = undefined
                }
                return { ...c, text, keyframes }
              }),
            }
          }),
        }
      })
    },

    applyTextPreset(clipId, preset) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => {
            if (c.id !== clipId || !c.text) return c
            const D = c.duration
            const inT = Math.min(0.5, D * 0.4)
            const text = { ...c.text, typewriter: preset === 'typewriter', reveal: undefined }
            switch (preset) {
              case 'fade':
                return { ...c, text, keyframes: { opacity: [{ t: 0, value: 0 }, { t: inT, value: 1 }] } }
              case 'pop':
                return {
                  ...c,
                  text,
                  keyframes: {
                    scale: [{ t: 0, value: 0.6 }, { t: Math.min(0.22, D * 0.3), value: 1.12 }, { t: Math.min(0.4, D * 0.5), value: 1 }],
                    opacity: [{ t: 0, value: 0 }, { t: Math.min(0.18, D * 0.25), value: 1 }],
                  },
                }
              case 'slide':
                return {
                  ...c,
                  text,
                  keyframes: {
                    x: [{ t: 0, value: -0.35 }, { t: inT, value: 0 }],
                    opacity: [{ t: 0, value: 0 }, { t: Math.min(0.3, D * 0.3), value: 1 }],
                  },
                }
              case 'typewriter':
                return { ...c, text, keyframes: undefined }
              default:
                return { ...c, text: { ...c.text, typewriter: false, reveal: undefined }, keyframes: undefined }
            }
          }),
        })),
      }))
    },

    moveClip(clipId, trackId, start) {
      const clamped = Math.max(0, start)
      mutate((p) => {
        const found = findClip(p, clipId)
        if (!found) return p
        const moved: Clip = { ...found.clip, trackId, start: clamped }
        return {
          ...p,
          tracks: p.tracks.map((t) => {
            if (t.id === found.track.id && t.id === trackId) {
              return { ...t, clips: t.clips.map((c) => (c.id === clipId ? moved : c)) }
            }
            if (t.id === found.track.id) {
              return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
            }
            if (t.id === trackId) {
              return { ...t, clips: [...t.clips, moved] }
            }
            return t
          }),
        }
      })
    },

    splitAtPlayhead() {
      const { selectedClipId, currentTime } = get()
      if (!selectedClipId) return
      mutate((p) => {
        const found = findClip(p, selectedClipId)
        if (!found) return p
        const { clip, track } = found
        const localOffset = currentTime - clip.start
        if (localOffset <= 0.01 || localOffset >= clip.duration - 0.01) return p
        const left: Clip = { ...clip, duration: localOffset, trimEnd: clip.trimStart + localOffset }
        const right: Clip = {
          ...clip,
          id: uid(),
          start: clip.start + localOffset,
          duration: clip.duration - localOffset,
          trimStart: clip.trimStart + localOffset,
        }
        return {
          ...p,
          tracks: p.tracks.map((t) =>
            t.id === track.id
              ? { ...t, clips: t.clips.flatMap((c) => (c.id === clip.id ? [left, right] : [c])) }
              : t,
          ),
        }
      })
    },

    deleteClip(clipId) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
      }))
      set({ selectedClipIds: get().selectedClipIds.filter((i) => i !== clipId) })
      if (get().selectedClipId === clipId) set({ selectedClipId: null })
    },

    rippleDeleteClip(clipId) {
      mutate((p) => {
        const found = findClip(p, clipId)
        if (!found) return p
        const gap = found.clip.duration
        const at = found.clip.start
        return {
          ...p,
          tracks: p.tracks.map((t) =>
            t.id !== found.track.id
              ? t
              : {
                  ...t,
                  clips: t.clips
                    .filter((c) => c.id !== clipId)
                    .map((c) => (c.start >= at ? { ...c, start: Math.max(0, c.start - gap) } : c)),
                },
          ),
        }
      })
      set({ selectedClipIds: get().selectedClipIds.filter((i) => i !== clipId) })
      if (get().selectedClipId === clipId) set({ selectedClipId: null })
    },

    async pulseToBeats(coverClipId) {
      const project = get().project
      if (!project) return 0
      const found = findClip(project, coverClipId)
      if (!found || (found.clip.type !== 'image' && found.clip.type !== 'video')) return 0
      const song = project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'audio' && c.mediaId)
      if (!song?.mediaId) return 0
      const blob = await storage.getMediaBlob(song.mediaId)
      if (!blob) return 0
      const beats = await getBeats(song.mediaId, blob)
      const D = found.clip.duration
      const rampAt = (t: number) => 1 + 0.12 * Math.max(0, Math.min(1, t / D))
      // Linear Ken-Burns drift with a small punch on each beat.
      const kf: { t: number; value: number; ease?: 'out' | 'inout' }[] = [{ t: 0, value: 1, ease: 'inout' }]
      for (const bt of beats) {
        if (bt <= 0.06 || bt >= D - 0.06) continue
        kf.push({ t: round3(bt), value: round3(rampAt(bt) + 0.05), ease: 'out' })
        const back = Math.min(D - 0.02, bt + 0.12)
        kf.push({ t: round3(back), value: round3(rampAt(back)), ease: 'inout' })
      }
      kf.push({ t: round3(D), value: 1.12 })
      kf.sort((a, b) => a.t - b.t)
      const scale: typeof kf = []
      for (const k of kf) if (!scale.length || Math.abs(scale[scale.length - 1].t - k.t) > 1e-3) scale.push(k)
      if (scale.length <= 2) return 0
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) => (c.id === coverClipId ? { ...c, keyframes: { ...c.keyframes, scale } } : c)),
        })),
      }))
      return beats.length
    },

    async applyMotion(clipId, preset) {
      const project = get().project
      if (!project) return
      const found = findClip(project, clipId)
      if (!found || (found.clip.type !== 'image' && found.clip.type !== 'video')) return
      const clip = found.clip
      let beats: number[] = []
      if (preset === 'beatPulse') {
        const song = project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'audio' && c.mediaId)
        if (song?.mediaId) {
          const blob = await storage.getMediaBlob(song.mediaId)
          if (blob) {
            const raw = await getBeats(song.mediaId, blob)
            // Map the song's beats into this clip's local time.
            beats = raw
              .filter((b) => b >= song.trimStart && b <= song.trimEnd)
              .map((b) => song.start + (b - song.trimStart) - clip.start)
              .filter((b) => b >= 0 && b <= clip.duration)
          }
        }
      }
      const kf = motionKeyframes(preset, { duration: clip.duration, beats })
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((tr) => ({
          ...tr,
          clips: tr.clips.map((c) =>
            c.id === clipId ? { ...c, keyframes: preset === 'none' ? undefined : kf } : c,
          ),
        })),
      }))
    },

    async setVisualizer(patch) {
      const cur = get().project?.visualizer ?? { enabled: false }
      mutate((p) => ({ ...p, visualizer: { ...cur, ...patch } }))
      if (get().project?.visualizer?.enabled) await ensureSpectrum()
    },

    async beatCutToBeats(clipIds, k = 2) {
      const project = get().project
      if (!project) return 0
      // Selected image/video clips, in timeline order.
      const founds = clipIds
        .map((id) => findClip(project, id))
        .filter(
          (f): f is { track: Track; clip: Clip } =>
            !!f && (f.clip.type === 'image' || f.clip.type === 'video') && !!f.clip.mediaId,
        )
        .sort((a, b) => a.clip.start - b.clip.start)
      if (!founds.length) return 0

      const song = project.tracks.flatMap((t) => t.clips).find((c) => c.type === 'audio' && c.mediaId)
      if (!song?.mediaId) return 0
      const blob = await storage.getMediaBlob(song.mediaId)
      if (!blob) return 0
      const raw = await getBeats(song.mediaId, blob)

      const songStart = song.start
      const songSpan = song.duration
      // Map song source-time onsets into timeline time, then make them song-relative.
      const beats = raw
        .filter((b) => b >= song.trimStart && b <= song.trimEnd)
        .map((b) => song.start + (b - song.trimStart) - songStart)

      const sources: BeatCutSource[] = founds.map((f) => ({
        mediaId: f.clip.mediaId as string,
        type: f.clip.type as 'image' | 'video',
        sourceDuration: f.clip.type === 'video' ? f.clip.trimEnd - f.clip.trimStart : undefined,
      }))
      const segments = planBeatCut({ beats, songDuration: songSpan, sourceCount: sources.length, k })
      if (!segments.length) return 0

      const trackId = founds[0].track.id
      const newClips = clipsFromSegments({ segments, sources, trackId, makeId: uid }).map((c) => ({
        ...c,
        start: round3(c.start + songStart),
      }))
      const removeIds = new Set(founds.map((f) => f.clip.id))

      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) =>
          t.id !== trackId
            ? { ...t, clips: t.clips.filter((c) => !removeIds.has(c.id)) }
            : {
                ...t,
                clips: [...t.clips.filter((c) => !removeIds.has(c.id)), ...newClips].sort(
                  (a, b) => a.start - b.start,
                ),
              },
        ),
      }))
      set({ selectedClipIds: newClips.map((c) => c.id), selectedClipId: newClips[0]?.id ?? null })
      return segments.length
    },

    addMarker(time) {
      mutate((p) => ({
        ...p,
        markers: [...(p.markers ?? []), { id: uid(), time: Math.max(0, time), label: '' }],
      }))
    },

    removeMarker(id) {
      mutate((p) => ({ ...p, markers: (p.markers ?? []).filter((m) => m.id !== id) }))
    },

    clearMarkers() {
      mutate((p) => ({ ...p, markers: [] }))
    },

    async detectBeats(clipId) {
      const project = get().project
      if (!project) return 0
      const found = findClip(project, clipId)
      if (!found || !found.clip.mediaId) return 0
      const blob = await storage.getMediaBlob(found.clip.mediaId)
      if (!blob) return 0
      const beats = await getBeats(found.clip.mediaId, blob)
      const clip = found.clip
      // Map source-time onsets into the clip's visible timeline span.
      const times = beats
        .filter((b) => b >= clip.trimStart && b <= clip.trimEnd)
        .map((b) => clip.start + (b - clip.trimStart))
        .slice(0, 200)
      if (!times.length) return 0
      mutate((p) => ({
        ...p,
        markers: [...(p.markers ?? []), ...times.map((t) => ({ id: uid(), time: t, label: 'beat' }))],
      }))
      return times.length
    },

    duplicateClip(clipId) {
      mutate((p) => {
        const found = findClip(p, clipId)
        if (!found) return p
        const { clip, track } = found
        const copy: Clip = { ...clip, id: uid(), start: clip.start + clip.duration }
        return {
          ...p,
          tracks: p.tracks.map((t) =>
            t.id === track.id ? { ...t, clips: [...t.clips, copy] } : t,
          ),
        }
      })
    },

    selectClip(clipId, additive) {
      if (clipId == null) {
        set({ selectedClipId: null, selectedClipIds: [] })
        return
      }
      if (additive) {
        const ids = get().selectedClipIds
        const next = ids.includes(clipId) ? ids.filter((i) => i !== clipId) : [...ids, clipId]
        set({ selectedClipIds: next, selectedClipId: next[next.length - 1] ?? null })
      } else {
        set({ selectedClipId: clipId, selectedClipIds: [clipId] })
      }
    },

    copySelection() {
      const { project, selectedClipIds } = get()
      if (!project || !selectedClipIds.length) return
      const all = project.tracks.flatMap((t) => t.clips)
      const clips = selectedClipIds
        .map((id) => all.find((c) => c.id === id))
        .filter((c): c is Clip => !!c)
        .map((c) => structuredCloneClip(c))
      set({ clipboard: clips })
    },

    pasteClipboard() {
      const { clipboard, currentTime } = get()
      if (!clipboard || !clipboard.length) return
      const base = Math.min(...clipboard.map((c) => c.start))
      const newIds: string[] = []
      mutate((p) => {
        let project = p
        const additions = new Map<string, Clip[]>()
        for (const c of clipboard) {
          const wanted: TrackType = c.type === 'audio' ? 'audio' : c.type === 'text' ? 'text' : 'video'
          let track = project.tracks.find((t) => t.id === c.trackId) ?? project.tracks.find((t) => t.type === wanted)
          if (!track) {
            const created = trackForType(project, c.type)
            project = created.project
            track = project.tracks.find((t) => t.id === created.trackId)!
          }
          const clip: Clip = { ...structuredCloneClip(c), id: uid(), trackId: track.id, start: currentTime + (c.start - base) }
          newIds.push(clip.id)
          additions.set(track.id, [...(additions.get(track.id) ?? []), clip])
        }
        return {
          ...project,
          tracks: project.tracks.map((t) =>
            additions.has(t.id) ? { ...t, clips: [...t.clips, ...additions.get(t.id)!] } : t,
          ),
        }
      })
      set({ selectedClipIds: newIds, selectedClipId: newIds[newIds.length - 1] ?? null })
    },

    nudgeSelection(deltaSeconds) {
      const ids = new Set(get().selectedClipIds)
      if (!ids.size) return
      mutate(
        (p) => ({
          ...p,
          tracks: p.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (ids.has(c.id) ? { ...c, start: Math.max(0, c.start + deltaSeconds) } : c)),
          })),
        }),
        'nudge',
      )
    },

    deleteSelection() {
      const ids = new Set(get().selectedClipIds)
      if (!ids.size) return
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !ids.has(c.id)) })),
      }))
      set({ selectedClipId: null, selectedClipIds: [] })
    },

    setCurrentTime(t) {
      set({ currentTime: Math.max(0, t) })
    },

    setPlaying(p) {
      set({ isPlaying: p })
    },

    togglePlay() {
      const { isPlaying, currentTime, project } = get()
      if (!isPlaying && currentTime >= projectDuration(project) - 0.05) {
        set({ currentTime: 0 })
      }
      set({ isPlaying: !isPlaying })
    },

    setZoom(z) {
      set({ zoom: Math.min(8, Math.max(0.25, z)) })
    },
  }
})

/** Deep-clone a clip (plain serialisable data) so nested keyframes/text/fx aren't shared. */
function structuredCloneClip(c: Clip): Clip {
  return JSON.parse(JSON.stringify(c))
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function trackName(type: TrackType): string {
  if (type === 'video') return 'Video'
  if (type === 'audio') return 'Audio'
  return 'Text'
}

function endOfTrack(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0)
}

/** Create a fresh empty project with default video + audio tracks and persist it. */
export async function createProject(name: string, opts?: Partial<Project>): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: uid(),
    name: name.trim() || 'Untitled project',
    createdAt: now,
    updatedAt: now,
    width: opts?.width ?? 1920,
    height: opts?.height ?? 1080,
    fps: opts?.fps ?? 30,
    background: opts?.background ?? '#000000',
    masterVolume: 1,
    markers: [],
    tracks: [
      { id: uid(), type: 'text', name: 'Text', muted: false, solo: false, volume: 1, clips: [] },
      { id: uid(), type: 'video', name: 'Video', muted: false, solo: false, volume: 1, clips: [] },
      { id: uid(), type: 'audio', name: 'Audio', muted: false, solo: false, volume: 1, clips: [] },
    ],
  }
  await storage.saveProject(project)
  return project
}
