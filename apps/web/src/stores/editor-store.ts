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
import { DEFAULT_STILL_DURATION } from '#/types/editor'
import * as storage from '#/lib/storage'
import { detectMediaType, probeMedia } from '#/lib/media'

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
  currentTime: number
  isPlaying: boolean
  /** Timeline zoom multiplier (pixels per second = base * zoom). */
  zoom: number
  loading: boolean
  importing: boolean

  loadProject: (id: string) => Promise<void>
  closeProject: () => void
  updateProject: (patch: Partial<Project>) => void

  importFiles: (files: FileList | File[]) => Promise<void>
  removeMedia: (id: string) => Promise<void>
  getMediaUrl: (mediaId: string) => string | undefined

  addTrack: (type: TrackType) => string
  addClipFromMedia: (mediaId: string, atTime?: number) => void
  addTextClip: () => void
  updateClip: (clipId: string, patch: Partial<Clip>) => void
  moveClip: (clipId: string, trackId: string, start: number) => void
  splitAtPlayhead: () => void
  deleteClip: (clipId: string) => void
  duplicateClip: (clipId: string) => void
  selectClip: (clipId: string | null) => void

  setCurrentTime: (t: number) => void
  setPlaying: (p: boolean) => void
  togglePlay: () => void
  setZoom: (z: number) => void
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useEditorStore = create<EditorState>((set, get) => {
  /** Apply a transform to the project, bump updatedAt, and schedule a save. */
  function mutate(fn: (p: Project) => Project) {
    const current = get().project
    if (!current) return
    const next = { ...fn(current), updatedAt: Date.now() }
    set({ project: next })
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void storage.saveProject(next)
    }, 400)
  }

  function findClip(p: Project, clipId: string): { track: Track; clip: Clip } | null {
    for (const track of p.tracks) {
      const clip = track.clips.find((c) => c.id === clipId)
      if (clip) return { track, clip }
    }
    return null
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
    currentTime: 0,
    isPlaying: false,
    zoom: 1,
    loading: false,
    importing: false,

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
      })
    },

    closeProject() {
      const { mediaUrls } = get()
      Object.values(mediaUrls).forEach((url) => URL.revokeObjectURL(url))
      set({ project: null, media: [], mediaUrls: {}, selectedClipId: null, currentTime: 0, isPlaying: false })
    },

    updateProject(patch) {
      mutate((p) => ({ ...p, ...patch }))
    },

    async importFiles(files) {
      const project = get().project
      if (!project) return
      set({ importing: true })
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
        }
      } finally {
        set({ importing: false })
      }
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
        tracks: [...p.tracks, { id, type, name: trackName(type), muted: false, clips: [] }],
      }))
      return id
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

    addTextClip() {
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
          text: { ...DEFAULT_TEXT },
        }
        return {
          ...project,
          tracks: project.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        }
      })
    },

    updateClip(clipId, patch) {
      mutate((p) => ({
        ...p,
        tracks: p.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
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
      if (get().selectedClipId === clipId) set({ selectedClipId: null })
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

    selectClip(clipId) {
      set({ selectedClipId: clipId })
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
    tracks: [
      { id: uid(), type: 'text', name: 'Text', muted: false, clips: [] },
      { id: uid(), type: 'video', name: 'Video', muted: false, clips: [] },
      { id: uid(), type: 'audio', name: 'Audio', muted: false, clips: [] },
    ],
  }
  await storage.saveProject(project)
  return project
}
