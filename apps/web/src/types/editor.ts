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

export type ClipType = 'video' | 'audio' | 'image' | 'text' | 'shape'

export interface ShapeProperties {
  kind: 'rect' | 'ellipse' | 'line' | 'arrow'
  /** Centre, 0..1 of the canvas. */
  x: number
  y: number
  /** Size, 0..1 of the canvas. */
  w: number
  h: number
  /** Fill colour; undefined/'none' = no fill. */
  fill?: string
  stroke?: string
  strokeWidth: number
  /** Rounded-rect corner radius, px (rect only). */
  radius?: number
}

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
  /** Outline stroke colour + width (px). Width 0/undefined = no stroke. */
  strokeColor?: string
  strokeWidth?: number
  /** Drop shadow. */
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  /** Extra spacing between letters, px. */
  letterSpacing?: number
  /** Line height multiplier (default 1.2). */
  lineHeight?: number
  /** Background box padding (px) and corner radius (px). */
  bgPadding?: number
  bgRadius?: number
  /** Typewriter reveal: static fraction 0..1 of characters shown. */
  reveal?: number
  /** When set, reveal animates over time (typewriter effect) instead of using `reveal`. */
  typewriter?: boolean
  /** Karaoke: highlight each word as it's sung (needs `words`). */
  karaoke?: boolean
  /** Highlight colour for already-sung words in karaoke mode. */
  karaokeColor?: string
  /** Per-word timing in clip-local seconds, for karaoke highlighting. */
  words?: { start: number; end: number; text: string }[]
}

/** Default geometry for a newly-added shape clip. */
export const DEFAULT_SHAPES: Record<ShapeProperties['kind'], ShapeProperties> = {
  rect: { kind: 'rect', x: 0.5, y: 0.5, w: 0.3, h: 0.2, fill: '#22d3ee', stroke: '#0b1220', strokeWidth: 0, radius: 0 },
  ellipse: { kind: 'ellipse', x: 0.5, y: 0.5, w: 0.25, h: 0.25, fill: '#22d3ee', stroke: '#0b1220', strokeWidth: 0 },
  line: { kind: 'line', x: 0.5, y: 0.5, w: 0.35, h: 0, stroke: '#22d3ee', strokeWidth: 6 },
  arrow: { kind: 'arrow', x: 0.5, y: 0.5, w: 0.35, h: 0, stroke: '#22d3ee', strokeWidth: 6 },
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
  /** Volume automation: time-sorted {t (clip-local seconds), value 0..1}. Overrides `volume`. */
  volumeKeyframes?: { t: number; value: number }[]
  /** Dedicated audio fade in/out durations (seconds), independent of transitions. */
  fadeIn?: number
  fadeOut?: number
  /** Per-clip Web Audio effects chain (see lib/audio-fx). */
  audioFx?: { eqLow: number; eqMid: number; eqHigh: number; compressor: number; reverb: number; highpass: number }
  /** Color-grade filter preset id for video/image clips (see lib/filters). */
  filter?: string
  /** Per-clip color adjustments, composed after the preset (see lib/adjust). */
  adjust?: { brightness: number; contrast: number; saturation: number; hue: number }
  /** Per-clip blend mode (canvas globalCompositeOperation); 'normal'/undefined = source-over. */
  blend?: string
  /** Per-clip reveal mask (see lib/mask). */
  mask?: { shape: 'rect' | 'ellipse' | 'linear'; x: number; y: number; w: number; h: number; angle?: number; feather?: number; invert?: boolean }
  /** Chroma key (green-screen) removal via the WebGL pass (see lib/chroma). */
  chroma?: { color: string; similarity: number; smoothness: number; spill: number }
  /** Story beat role for producer handoff/EDL (see lib/beats). */
  role?: string
  /** Enter/exit transitions (see lib/transitions). */
  transitionIn?: { type: string; duration: number }
  transitionOut?: { type: string; duration: number }
  /** Playback rate for video/audio clips (1 = normal). */
  speed?: number
  /** How the source fills the frame: 'contain' (letterbox) or 'cover' (fill+crop). Default contain. */
  fit?: 'contain' | 'cover'
  /** Visual transform for video/image clips. */
  transform?: { x: number; y: number; scale: number; rotation: number; opacity: number }
  /**
   * Per-property animation keyframes (Phase 1: Motion & Keyframes).
   * `t` is seconds relative to the clip's start, kept time-sorted. A property
   * with no keyframes uses the static `transform` value; with keyframes the
   * animation (linear interpolation) overrides it. See lib/keyframes.ts.
   */
  keyframes?: Partial<
    Record<
      'x' | 'y' | 'scale' | 'rotation' | 'opacity',
      { t: number; value: number; ease?: 'linear' | 'in' | 'out' | 'inout' | 'hold' }[]
    >
  >
  text?: TextProperties
  shape?: ShapeProperties
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
  /** On-frame audio "sound bar" visualizer (reacts to the song; baked into export). */
  visualizer?: {
    enabled: boolean
    /** Bar colour (CSS). Default cream. */
    color?: string
    /** Bar colour when the bass thumps, if bassReactive. Default energy red. */
    bassColor?: string
    /** Flash bassColor on strong low-end hits. */
    bassReactive?: boolean
    /** Vertical centre, 0..1 of the frame. Default 0.9 (near the bottom). */
    y?: number
  }
  /** Promo provenance when this project was started from a Pam song (see lib/pam-import). */
  promo?: {
    source: 'pam' | 'studio'
    title: string
    artist?: string
    campaign?: {
      hook?: string
      audience?: string
      captionDraft?: string
      teaserIdeas?: string[]
      rolloutNotes?: string
    } | null
  }
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
