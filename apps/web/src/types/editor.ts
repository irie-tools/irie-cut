// Core domain types for the Irie Cut editor.
// Everything here is plain serialisable data so a project can be persisted
// to IndexedDB and rehydrated without any class instances.

export type MediaType = 'video' | 'audio' | 'image'

export interface MediaAsset {
  id: string
  projectId: string
  name: string
  type: MediaType
  mimeType: string
  size: number
  /** Source duration in seconds. Images default to 0 (treated as 5s on the timeline). */
  duration: number
  width: number
  height: number
  /** data-URL thumbnail for the media panel. */
  thumbnail?: string
  createdAt: number
}

export type TrackType = 'video' | 'audio' | 'text'

export type ClipType = 'video' | 'audio' | 'image' | 'text'

export interface TextProperties {
  content: string
  fontSize: number
  color: string
  fontFamily: string
  /** Relative position of the text box centre, 0..1 of the canvas. */
  x: number
  y: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  /** Optional solid background behind the text. */
  background?: string
}

export interface Clip {
  id: string
  trackId: string
  type: ClipType
  name: string
  /** For media clips, points at a MediaAsset. Undefined for text clips. */
  mediaId?: string
  /** Position of the clip on the timeline, in seconds. */
  start: number
  /** Length of the clip on the timeline, in seconds. */
  duration: number
  /** In-point within the source media, in seconds. */
  trimStart: number
  /** Out-point within the source media, in seconds. */
  trimEnd: number
  /** 0..1 audio gain for video/audio clips. */
  volume: number
  /** Color-grade filter preset id for video/image clips (see lib/filters). */
  filter?: string
  /** Story beat role for producer handoff/EDL (see lib/beats). */
  role?: string
  text?: TextProperties
}

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  clips: Clip[]
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  width: number
  height: number
  fps: number
  /** Background colour of the canvas, any CSS colour. */
  background: string
  tracks: Track[]
}

/** Default canvas size for a new project (16:9 1080p). */
export const DEFAULT_PROJECT = {
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
} as const

/** Images and text clips have no intrinsic duration; this is their default length. */
export const DEFAULT_STILL_DURATION = 5
