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
  /** Enter/exit transitions (see lib/transitions). */
  transitionIn?: { type: string; duration: number }
  transitionOut?: { type: string; duration: number }
  /** Playback rate for video/audio clips (1 = normal). */
  speed?: number
  /** Visual transform for video/image clips. */
  transform?: { x: number; y: number; scale: number; rotation: number; opacity: number }
  /**
   * Per-property animation keyframes (Phase 1: Motion & Keyframes).
   * `t` is seconds relative to the clip's start, kept time-sorted. A property
   * with no keyframes uses the static `transform` value; with keyframes the
   * animation (linear interpolation) overrides it. See lib/keyframes.ts.
   */
  keyframes?: Partial<
    Record<'x' | 'y' | 'scale' | 'rotation' | 'opacity', { t: number; value: number }[]>
  >
  text?: TextProperties
}

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  /** Solo isolates this track's audio (and any other soloed tracks). Optional for older projects. */
  solo?: boolean
  /** Locked tracks ignore clip edits. Optional for older projects. */
  locked?: boolean
  /** 0..1 per-track gain. Optional for older projects (defaults to 1). */
  volume?: number
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
  /** 0..1 master output gain. Optional for older projects (defaults to 1). */
  masterVolume?: number
  /** Timeline markers (seconds + label). */
  markers?: { id: string; time: number; label: string }[]
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
