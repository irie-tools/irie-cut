import { useState } from 'react'
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useEditorStore } from '#/stores/editor-store'
import type { Clip, TextProperties, ShapeProperties } from '#/types/editor'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Slider } from '#/components/ui/slider'
import { ScrollArea } from '#/components/ui/scroll-area'
import { cn } from '#/lib/utils'
import {
  transformAt,
  keyframeAtTime,
  hasKeyframes,
  EASINGS,
  type KeyframeProp,
  type Easing,
} from '#/lib/keyframes'
import { FILTER_PRESETS } from '#/lib/filters'
import { DEFAULT_ADJUST, isNeutralAdjust } from '#/lib/adjust'
import { BLEND_MODES, blendOp } from '#/lib/blend'
import { DEFAULT_MASK, MASK_SHAPES } from '#/lib/mask'
import { DEFAULT_CHROMA } from '#/lib/chroma'
import { FONT_OPTIONS, normalizeFont } from '#/lib/fonts'
import { clipVolumeAt } from '#/lib/audio'
import { DEFAULT_FX, isNeutralFx } from '#/lib/audio-fx'
import { getBrandKit, addBrandColor, removeBrandColor, setBrandFont } from '#/lib/brand-kit'
import { CAPTION_STYLES } from '#/lib/caption-styles'
import { BEAT_ROLES, roleLabel } from '#/lib/beats'
import { TRANSITIONS } from '#/lib/transitions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const project = useEditorStore((s) => s.project)
  const clip = project?.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2.5 text-sm font-medium">
        {clip ? 'Clip properties' : 'Project'}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-3">
          {clip ? <ClipProps clip={clip} /> : <ProjectProps />}
        </div>
      </ScrollArea>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ClipProps({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)

  return (
    <>
      <Row label="Start (s)">
        <Input
          type="number"
          step={0.1}
          min={0}
          value={round(clip.start)}
          onChange={(e) => updateClip(clip.id, { start: Math.max(0, Number(e.target.value) || 0) })}
        />
      </Row>
      <Row label="Duration (s)">
        <Input
          type="number"
          step={0.1}
          min={0.1}
          value={round(clip.duration)}
          onChange={(e) =>
            updateClip(clip.id, { duration: Math.max(0.1, Number(e.target.value) || 0.1) })
          }
        />
      </Row>
      <Row label="Story role">
        <Select
          value={clip.role ?? 'none'}
          onValueChange={(v) => updateClip(clip.id, { role: v ?? 'none' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{(v: string | null) => roleLabel(v ?? undefined) ?? 'None'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BEAT_ROLES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      {(clip.type === 'video' || clip.type === 'audio') && <VolumeControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'audio') && clip.mediaId && <BeatControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'audio') && <AudioFxControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'audio') && (
        <Row label={`Speed · ${(clip.speed ?? 1).toFixed(2)}×`}>
          <Slider
            value={[clip.speed ?? 1]}
            min={0.25}
            max={4}
            step={0.05}
            onValueChange={(v) => updateClip(clip.id, { speed: sv(v) }, `spd:${clip.id}`)}
          />
        </Row>
      )}

      {clip.type === 'shape' && clip.shape && <ShapeProps clip={clip} shape={clip.shape} />}

      {(clip.type === 'video' || clip.type === 'image') && (
        <Row label="Fit">
          <div className="flex gap-1">
            {(['contain', 'cover'] as const).map((f) => (
              <Toggle key={f} active={(clip.fit ?? 'contain') === f} onClick={() => updateClip(clip.id, { fit: f })}>
                <span className="px-2 text-xs capitalize">{f}</span>
              </Toggle>
            ))}
          </div>
        </Row>
      )}

      {(clip.type === 'video' || clip.type === 'image' || clip.type === 'shape') && <TransformControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'image') && (
        <Row label="Filter">
          <div className="grid grid-cols-4 gap-1.5">
            {FILTER_PRESETS.map((f) => {
              const active = (clip.filter ?? 'none') === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => updateClip(clip.id, { filter: f.id })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border p-1 transition-colors',
                    active ? 'border-primary' : 'border-transparent hover:border-border',
                  )}
                  title={f.label}
                >
                  <span
                    className="h-8 w-full rounded"
                    style={{ background: f.swatch }}
                  />
                  <span className="truncate text-[10px] text-muted-foreground">{f.label}</span>
                </button>
              )
            })}
          </div>
        </Row>
      )}

      {(clip.type === 'video' || clip.type === 'image') && <AdjustControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'image' || clip.type === 'shape') && (
        <Row label="Blend mode">
          <Select
            value={blendOp(clip.blend)}
            onValueChange={(v) => updateClip(clip.id, { blend: v === 'source-over' ? undefined : (v ?? undefined) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLEND_MODES.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      )}

      {(clip.type === 'video' || clip.type === 'image') && <ChromaControls clip={clip} />}

      {(clip.type === 'video' || clip.type === 'image') && <MaskControls clip={clip} />}

      {clip.type !== 'audio' && <TransitionControls clip={clip} />}

      {clip.type === 'text' && clip.text && (
        <TextProps clip={clip} text={clip.text} />
      )}
    </>
  )
}

const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }

interface TransformRowSpec {
  prop: KeyframeProp
  label: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
}

const TRANSFORM_ROWS: TransformRowSpec[] = [
  { prop: 'scale', label: 'Scale', min: 0.1, max: 3, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { prop: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { prop: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, fmt: (v) => `${Math.round(v)}°` },
  { prop: 'x', label: 'X', min: -1, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { prop: 'y', label: 'Y', min: -1, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
]

/** Read the easing currently shared by a clip's keyframes ('linear' if mixed/none). */
function clipEasing(clip: Clip): string {
  const all = (['x', 'y', 'scale', 'rotation', 'opacity'] as const).flatMap((p) => clip.keyframes?.[p] ?? [])
  const eases = new Set(all.map((k) => k.ease ?? 'linear'))
  return eases.size === 1 ? [...eases][0] : 'linear'
}

function TransformControls({ clip }: { clip: Clip }) {
  const clearKeyframes = useEditorStore((s) => s.clearKeyframes)
  const setClipEasing = useEditorStore((s) => s.setClipEasing)
  // Subscribe to the playhead so keyframe state + interpolated slider values
  // follow the playhead as it scrubs/plays.
  const currentTime = useEditorStore((s) => s.currentTime)
  const fps = useEditorStore((s) => s.project?.fps ?? 30)

  const localT = currentTime - clip.start
  const insideClip = localT >= -1e-6 && localT <= clip.duration + 1e-6
  const animated = transformAt(clip, Math.max(0, Math.min(clip.duration, localT)))
  const anyKeys = hasKeyframes(clip)

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Transform</Label>
        {anyKeys && (
          <button
            onClick={() => clearKeyframes(clip.id)}
            className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title="Remove all keyframes (revert to static)"
          >
            Clear motion
          </button>
        )}
      </div>
      {!insideClip && anyKeys && (
        <p className="-mt-2 text-[10px] text-muted-foreground">
          Playhead is outside this clip — move it over the clip to edit keyframes.
        </p>
      )}
      {anyKeys && (
        <Row label="Motion easing">
          <Select value={clipEasing(clip)} onValueChange={(v) => setClipEasing(clip.id, (v as Easing) ?? 'linear')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EASINGS.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      )}
      {TRANSFORM_ROWS.map((row) => (
        <KeyframeRow
          key={row.prop}
          clip={clip}
          spec={row}
          localT={localT}
          insideClip={insideClip}
          fps={fps}
          animatedValue={animated[row.prop]}
        />
      ))}
    </>
  )
}

function KeyframeRow({
  clip,
  spec,
  localT,
  insideClip,
  fps,
  animatedValue,
}: {
  clip: Clip
  spec: TransformRowSpec
  localT: number
  insideClip: boolean
  fps: number
  animatedValue: number
}) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const setKeyframe = useEditorStore((s) => s.setKeyframe)
  const removeKeyframe = useEditorStore((s) => s.removeKeyframe)

  const tr = clip.transform ?? DEFAULT_TRANSFORM
  const keys = clip.keyframes?.[spec.prop]
  const keyed = !!keys && keys.length > 0
  const writeT = Math.max(0, Math.min(clip.duration, localT))
  const frameTol = 0.5 / fps + 1e-6
  const onKfTime = keyed && insideClip ? keyframeAtTime(keys, localT, frameTol) : null
  const onKf = onKfTime != null

  // Keyed → show the interpolated value at the playhead; static → the stored value.
  const displayValue = keyed ? animatedValue : tr[spec.prop]
  const sliderValue = Math.max(spec.min, Math.min(spec.max, displayValue))
  // Slider is live unless animating from outside the clip span (no valid time to write).
  const sliderDisabled = keyed && !insideClip

  function onSlide(v: number | readonly number[]) {
    const value = sv(v)
    if (keyed) {
      if (!insideClip) return
      setKeyframe(clip.id, spec.prop, writeT, value, `kf:${spec.prop}:${clip.id}`)
    } else {
      updateClip(clip.id, { transform: { ...tr, [spec.prop]: value } }, `${spec.prop}:${clip.id}`)
    }
  }

  function toggleDiamond() {
    if (!insideClip) return
    if (!keyed) {
      // First keyframe: pin the current static value at the playhead.
      setKeyframe(clip.id, spec.prop, writeT, tr[spec.prop])
    } else if (onKfTime != null) {
      removeKeyframe(clip.id, spec.prop, onKfTime)
    } else {
      setKeyframe(clip.id, spec.prop, writeT, displayValue)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          {spec.label} · {spec.fmt(displayValue)}
        </Label>
        <button
          onClick={toggleDiamond}
          disabled={!insideClip}
          aria-pressed={onKf}
          aria-label={`${spec.label} keyframe: ${
            keyed ? (onKf ? 'remove at playhead' : 'add at playhead') : 'animate from playhead'
          }`}
          title={
            keyed
              ? onKf
                ? 'Remove keyframe at playhead'
                : 'Add keyframe at playhead'
              : 'Animate — add first keyframe at playhead'
          }
          className={cn(
            'grid size-5 place-items-center rounded transition-colors disabled:opacity-30',
            keyed ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span
            className={cn(
              'size-2 rotate-45 border',
              onKf ? 'border-primary bg-primary' : keyed ? 'border-primary' : 'border-current',
            )}
          />
        </button>
      </div>
      <Slider
        value={[sliderValue]}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        disabled={sliderDisabled}
        onValueChange={onSlide}
      />
    </div>
  )
}

const ADJUST_ROWS: { key: 'brightness' | 'contrast' | 'saturation' | 'hue'; label: string; min: number; max: number; step: number; mid: number; fmt: (v: number) => string }[] = [
  { key: 'brightness', label: 'Brightness', min: 0.5, max: 1.5, step: 0.01, mid: 1, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'contrast', label: 'Contrast', min: 0.5, max: 1.5, step: 0.01, mid: 1, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, mid: 1, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'hue', label: 'Hue', min: -180, max: 180, step: 1, mid: 0, fmt: (v) => `${Math.round(v)}°` },
]

function AdjustControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const adj = { ...DEFAULT_ADJUST, ...(clip.adjust ?? {}) }
  const neutral = isNeutralAdjust(clip.adjust)
  const set = (patch: Partial<typeof DEFAULT_ADJUST>, key: string) =>
    updateClip(clip.id, { adjust: { ...adj, ...patch } }, `adj:${key}:${clip.id}`)

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Adjust</Label>
        {!neutral && (
          <button
            onClick={() => updateClip(clip.id, { adjust: undefined })}
            className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            title="Reset color adjustments"
          >
            Reset
          </button>
        )}
      </div>
      {ADJUST_ROWS.map((row) => (
        <Row key={row.key} label={`${row.label} · ${row.fmt(adj[row.key])}`}>
          <Slider
            value={[adj[row.key]]}
            min={row.min}
            max={row.max}
            step={row.step}
            onValueChange={(v) => set({ [row.key]: sv(v) }, row.key)}
          />
        </Row>
      ))}
    </>
  )
}

const FX_ROWS: { key: keyof typeof DEFAULT_FX; label: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { key: 'highpass', label: 'Voice cleanup', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'eqLow', label: 'EQ Low', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB` },
  { key: 'eqMid', label: 'EQ Mid', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB` },
  { key: 'eqHigh', label: 'EQ High', min: -12, max: 12, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB` },
  { key: 'compressor', label: 'Compressor', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'reverb', label: 'Reverb', min: 0, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
]

function AudioFxControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const fx = { ...DEFAULT_FX, ...(clip.audioFx ?? {}) }
  const neutral = isNeutralFx(clip.audioFx)
  const set = (patch: Partial<typeof DEFAULT_FX>, key: string) =>
    updateClip(clip.id, { audioFx: { ...fx, ...patch } }, `fx:${key}:${clip.id}`)

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Audio FX</Label>
        {!neutral && (
          <button onClick={() => updateClip(clip.id, { audioFx: undefined })} className="text-[10px] text-muted-foreground hover:text-foreground">
            Reset
          </button>
        )}
      </div>
      {FX_ROWS.map((row) => (
        <Row key={row.key} label={`${row.label} · ${row.fmt(fx[row.key])}`}>
          <Slider value={[fx[row.key]]} min={row.min} max={row.max} step={row.step} onValueChange={(v) => set({ [row.key]: sv(v) }, row.key)} />
        </Row>
      ))}
    </>
  )
}

function BeatControls({ clip }: { clip: Clip }) {
  const detectBeats = useEditorStore((s) => s.detectBeats)
  const clearMarkers = useEditorStore((s) => s.clearMarkers)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const n = await detectBeats(clip.id)
      setMsg(n ? `${n} beat markers added` : 'No beats detected')
    } catch {
      setMsg('Could not analyze audio')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Row label="Beat detection">
      <div className="flex gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
        >
          {busy ? 'Analyzing…' : 'Detect beats'}
        </button>
        <button
          onClick={() => clearMarkers()}
          className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Clear all markers"
        >
          Clear
        </button>
      </div>
      {msg && <p role="status" aria-live="polite" className="pt-1 text-[10px] text-muted-foreground">{msg}. Clips snap to markers when dragged.</p>}
    </Row>
  )
}

function VolumeControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const setVolumeKeyframe = useEditorStore((s) => s.setVolumeKeyframe)
  const removeVolumeKeyframe = useEditorStore((s) => s.removeVolumeKeyframe)
  const clearVolumeKeyframes = useEditorStore((s) => s.clearVolumeKeyframes)
  const currentTime = useEditorStore((s) => s.currentTime)
  const fps = useEditorStore((s) => s.project?.fps ?? 30)

  const keys = clip.volumeKeyframes
  const keyed = !!keys && keys.length > 0
  const localT = currentTime - clip.start
  const insideClip = localT >= -1e-6 && localT <= clip.duration + 1e-6
  const writeT = Math.max(0, Math.min(clip.duration, localT))
  const frameTol = 0.5 / fps + 1e-6
  const onKfTime = keyed && insideClip ? keyframeAtTime(keys, localT, frameTol) : null
  const display = keyed ? clipVolumeAt(clip, currentTime) : clip.volume

  function onSlide(v: number | readonly number[]) {
    const value = sv(v)
    if (keyed) {
      if (insideClip) setVolumeKeyframe(clip.id, writeT, value, `vkf:${clip.id}`)
    } else {
      updateClip(clip.id, { volume: value }, `vol:${clip.id}`)
    }
  }

  function toggleDiamond() {
    if (!insideClip) return
    if (!keyed) setVolumeKeyframe(clip.id, writeT, clip.volume)
    else if (onKfTime != null) removeVolumeKeyframe(clip.id, onKfTime)
    else setVolumeKeyframe(clip.id, writeT, display)
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Volume · {Math.round(display * 100)}%</Label>
          <div className="flex items-center gap-1">
            {keyed && (
              <button onClick={() => clearVolumeKeyframes(clip.id)} className="text-[10px] text-muted-foreground hover:text-foreground" title="Clear volume automation">
                Clear
              </button>
            )}
            <button
              onClick={toggleDiamond}
              disabled={!insideClip}
              title={keyed ? (onKfTime != null ? 'Remove volume keyframe' : 'Add volume keyframe') : 'Automate volume at playhead'}
              className={cn('grid size-5 place-items-center rounded transition-colors disabled:opacity-30', keyed ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground')}
            >
              <span className={cn('size-2 rotate-45 border', onKfTime != null ? 'border-primary bg-primary' : keyed ? 'border-primary' : 'border-current')} />
            </button>
          </div>
        </div>
        <Slider value={[Math.max(0, Math.min(1, display))]} min={0} max={1} step={0.01} disabled={keyed && !insideClip} onValueChange={onSlide} />
      </div>
      <div className="flex gap-3">
        <Row label={`Fade in · ${(clip.fadeIn ?? 0).toFixed(1)}s`}>
          <Slider value={[clip.fadeIn ?? 0]} min={0} max={Math.max(0.5, clip.duration / 2)} step={0.1} onValueChange={(v) => updateClip(clip.id, { fadeIn: sv(v) }, `fin:${clip.id}`)} />
        </Row>
        <Row label={`Fade out · ${(clip.fadeOut ?? 0).toFixed(1)}s`}>
          <Slider value={[clip.fadeOut ?? 0]} min={0} max={Math.max(0.5, clip.duration / 2)} step={0.1} onValueChange={(v) => updateClip(clip.id, { fadeOut: sv(v) }, `fout:${clip.id}`)} />
        </Row>
      </div>
    </>
  )
}

function ShapeProps({ clip, shape }: { clip: Clip; shape: ShapeProperties }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const set = (patch: Partial<ShapeProperties>, key?: string) =>
    updateClip(clip.id, { shape: { ...shape, ...patch } }, key ? `${key}:${clip.id}` : undefined)
  const isLine = shape.kind === 'line' || shape.kind === 'arrow'

  return (
    <>
      <Label className="block pt-1 text-xs font-semibold text-foreground">Shape</Label>
      <div className="flex gap-3">
        {!isLine && (
          <Row label="Fill">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={shape.fill ?? '#22d3ee'}
                onChange={(e) => set({ fill: e.target.value }, 'fill')}
                className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
              />
              <button
                onClick={() => set({ fill: shape.fill && shape.fill !== 'none' ? 'none' : '#22d3ee' })}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {shape.fill && shape.fill !== 'none' ? 'On' : 'Off'}
              </button>
            </div>
          </Row>
        )}
        <Row label="Stroke">
          <input
            type="color"
            value={shape.stroke ?? '#0b1220'}
            onChange={(e) => set({ stroke: e.target.value }, 'stroke')}
            className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
          />
        </Row>
      </div>
      <Row label={`Stroke width · ${shape.strokeWidth}px`}>
        <Slider value={[shape.strokeWidth]} min={0} max={40} step={1} onValueChange={(v) => set({ strokeWidth: sv(v) }, 'sw')} />
      </Row>
      <div className="flex gap-3">
        <Row label={`Width · ${Math.round(shape.w * 100)}%`}>
          <Slider value={[shape.w]} min={0.02} max={1} step={0.01} onValueChange={(v) => set({ w: sv(v) }, 'w')} />
        </Row>
        {!isLine && (
          <Row label={`Height · ${Math.round(shape.h * 100)}%`}>
            <Slider value={[shape.h]} min={0.02} max={1} step={0.01} onValueChange={(v) => set({ h: sv(v) }, 'h')} />
          </Row>
        )}
      </div>
      {shape.kind === 'rect' && (
        <Row label={`Corner radius · ${shape.radius ?? 0}px`}>
          <Slider value={[shape.radius ?? 0]} min={0} max={120} step={1} onValueChange={(v) => set({ radius: sv(v) }, 'r')} />
        </Row>
      )}
    </>
  )
}

function ChromaControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const chroma = clip.chroma
  const set = (patch: Partial<NonNullable<Clip['chroma']>>, key: string) =>
    updateClip(clip.id, { chroma: { ...DEFAULT_CHROMA, ...(chroma ?? {}), ...patch } }, `chroma:${key}:${clip.id}`)

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Chroma key</Label>
        <button
          onClick={() => updateClip(clip.id, { chroma: chroma ? undefined : { ...DEFAULT_CHROMA } })}
          className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {chroma ? 'Remove' : 'Add'}
        </button>
      </div>
      {chroma && (
        <>
          <Row label="Key color">
            <input
              type="color"
              value={chroma.color}
              onChange={(e) => set({ color: e.target.value }, 'color')}
              className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
            />
          </Row>
          <Row label={`Similarity · ${Math.round(chroma.similarity * 100)}%`}>
            <Slider value={[chroma.similarity]} min={0.01} max={1} step={0.01} onValueChange={(v) => set({ similarity: sv(v) }, 'sim')} />
          </Row>
          <Row label={`Smoothness · ${Math.round(chroma.smoothness * 100)}%`}>
            <Slider value={[chroma.smoothness]} min={0} max={0.5} step={0.01} onValueChange={(v) => set({ smoothness: sv(v) }, 'smo')} />
          </Row>
          <Row label={`Spill suppress · ${Math.round(chroma.spill * 100)}%`}>
            <Slider value={[chroma.spill]} min={0} max={1} step={0.01} onValueChange={(v) => set({ spill: sv(v) }, 'spl')} />
          </Row>
        </>
      )}
    </>
  )
}

function MaskControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const mask = clip.mask
  const set = (patch: Partial<NonNullable<Clip['mask']>>, key: string) =>
    updateClip(clip.id, { mask: { ...DEFAULT_MASK, ...(mask ?? {}), ...patch } }, `mask:${key}:${clip.id}`)

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Mask</Label>
        <button
          onClick={() => updateClip(clip.id, { mask: mask ? undefined : { ...DEFAULT_MASK } })}
          className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {mask ? 'Remove' : 'Add'}
        </button>
      </div>
      {mask && (
        <>
          <Row label="Shape">
            <Select value={mask.shape} onValueChange={(v) => set({ shape: (v as 'rect' | 'ellipse' | 'linear') ?? 'rect' }, 'shape')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MASK_SHAPES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <div className="flex gap-3">
            <Row label={`X · ${Math.round(mask.x * 100)}%`}>
              <Slider value={[mask.x]} min={0} max={1} step={0.01} onValueChange={(v) => set({ x: sv(v) }, 'x')} />
            </Row>
            <Row label={`Y · ${Math.round(mask.y * 100)}%`}>
              <Slider value={[mask.y]} min={0} max={1} step={0.01} onValueChange={(v) => set({ y: sv(v) }, 'y')} />
            </Row>
          </div>
          {mask.shape !== 'linear' && (
            <div className="flex gap-3">
              <Row label={`Width · ${Math.round(mask.w * 100)}%`}>
                <Slider value={[mask.w]} min={0.02} max={1} step={0.01} onValueChange={(v) => set({ w: sv(v) }, 'w')} />
              </Row>
              <Row label={`Height · ${Math.round(mask.h * 100)}%`}>
                <Slider value={[mask.h]} min={0.02} max={1} step={0.01} onValueChange={(v) => set({ h: sv(v) }, 'h')} />
              </Row>
            </div>
          )}
          {mask.shape === 'linear' && (
            <Row label={`Angle · ${Math.round(mask.angle ?? 0)}°`}>
              <Slider value={[mask.angle ?? 0]} min={0} max={360} step={1} onValueChange={(v) => set({ angle: sv(v) }, 'angle')} />
            </Row>
          )}
          <Row label={`Feather · ${Math.round((mask.feather ?? 0) * 100)}%`}>
            <Slider value={[mask.feather ?? 0]} min={0} max={1} step={0.01} onValueChange={(v) => set({ feather: sv(v) }, 'feather')} />
          </Row>
          <Row label="Invert">
            <Toggle active={!!mask.invert} onClick={() => set({ invert: !mask.invert }, 'invert')}>
              <span className="px-2 text-xs">{mask.invert ? 'Inverted' : 'Normal'}</span>
            </Toggle>
          </Row>
        </>
      )}
    </>
  )
}

function TransitionControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)

  function setSide(side: 'transitionIn' | 'transitionOut', type: string) {
    if (type === 'none') {
      updateClip(clip.id, { [side]: undefined })
    } else {
      const dur = clip[side]?.duration ?? 0.5
      updateClip(clip.id, { [side]: { type, duration: dur } })
    }
  }

  function setDuration(side: 'transitionIn' | 'transitionOut', duration: number) {
    const type = clip[side]?.type
    if (!type) return
    updateClip(clip.id, { [side]: { type, duration: Math.max(0.1, duration) } }, `trd:${side}:${clip.id}`)
  }

  return (
    <>
      {(['transitionIn', 'transitionOut'] as const).map((side) => {
        const spec = clip[side]
        return (
          <Row key={side} label={side === 'transitionIn' ? 'Transition in' : 'Transition out'}>
            <div className="flex gap-2">
              <Select value={spec?.type ?? 'none'} onValueChange={(v) => setSide(side, v ?? 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITIONS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {spec && (
                <Input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={spec.duration}
                  onChange={(e) => setDuration(side, Number(e.target.value) || 0.5)}
                  className="w-20"
                  title="Duration (s)"
                />
              )}
            </div>
          </Row>
        )
      })}
    </>
  )
}

const TEXT_PRESETS: { id: 'fade' | 'pop' | 'slide' | 'typewriter'; label: string }[] = [
  { id: 'fade', label: 'Fade in' },
  { id: 'pop', label: 'Pop' },
  { id: 'slide', label: 'Slide in' },
  { id: 'typewriter', label: 'Typewriter' },
]

function TextProps({ clip, text }: { clip: Clip; text: TextProperties }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const applyTextPreset = useEditorStore((s) => s.applyTextPreset)
  const applyCaptionStyle = useEditorStore((s) => s.applyCaptionStyle)
  const set = (patch: Partial<TextProperties>, coalesceKey?: string) =>
    updateClip(clip.id, { text: { ...text, ...patch } }, coalesceKey)

  return (
    <>
      <Row label="Caption style (whole track)">
        <div className="grid grid-cols-2 gap-1.5">
          {CAPTION_STYLES.map((cs) => (
            <button
              key={cs.id}
              onClick={() => applyCaptionStyle(clip.trackId, cs.id)}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {cs.label}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Animation">
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyTextPreset(clip.id, p.id)}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => applyTextPreset(clip.id, 'none')}
            className="col-span-2 rounded-md border border-transparent px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear animation
          </button>
        </div>
      </Row>
      <Row label="Text">
        <Textarea
          value={text.content}
          rows={2}
          onChange={(e) => set({ content: e.target.value }, `txt:${clip.id}`)}
        />
      </Row>
      <Row label="Font">
        <Select value={normalizeFont(text.fontFamily)} onValueChange={(v) => set({ fontFamily: v ?? FONT_OPTIONS[0].value })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.label} value={f.value}>
                <span style={{ fontFamily: f.value }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label={`Font size · ${text.fontSize}px`}>
        <Slider
          value={[text.fontSize]}
          min={12}
          max={240}
          step={1}
          onValueChange={(v) => set({ fontSize: sv(v) }, `fs:${clip.id}`)}
        />
      </Row>
      <div className="flex gap-3">
        <Row label="Color">
          <input
            type="color"
            value={text.color}
            onChange={(e) => set({ color: e.target.value }, `col:${clip.id}`)}
            className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
          />
        </Row>
        <Row label="Background">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={text.background ?? '#000000'}
              onChange={(e) => set({ background: e.target.value }, `bg:${clip.id}`)}
              className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
            />
            <button
              onClick={() => set({ background: text.background ? undefined : '#000000' })}
              className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {text.background ? 'On' : 'Off'}
            </button>
          </div>
        </Row>
      </div>
      <Row label="Style">
        <div className="flex gap-1">
          <Toggle active={text.bold} onClick={() => set({ bold: !text.bold })}>
            <Bold className="size-4" />
          </Toggle>
          <Toggle active={text.italic} onClick={() => set({ italic: !text.italic })}>
            <Italic className="size-4" />
          </Toggle>
          <div className="mx-1 w-px bg-border" />
          <Toggle active={text.align === 'left'} onClick={() => set({ align: 'left' })}>
            <AlignLeft className="size-4" />
          </Toggle>
          <Toggle active={text.align === 'center'} onClick={() => set({ align: 'center' })}>
            <AlignCenter className="size-4" />
          </Toggle>
          <Toggle active={text.align === 'right'} onClick={() => set({ align: 'right' })}>
            <AlignRight className="size-4" />
          </Toggle>
        </div>
      </Row>
      <Row label={`Horizontal · ${Math.round(text.x * 100)}%`}>
        <Slider value={[text.x]} min={0} max={1} step={0.01} onValueChange={(v) => set({ x: sv(v) }, `tx:${clip.id}`)} />
      </Row>
      <Row label={`Vertical · ${Math.round(text.y * 100)}%`}>
        <Slider value={[text.y]} min={0} max={1} step={0.01} onValueChange={(v) => set({ y: sv(v) }, `ty:${clip.id}`)} />
      </Row>

      <BrandKitControls text={text} onApply={(patch) => set(patch)} />

      <Label className="block pt-1 text-xs font-semibold text-foreground">Style details</Label>
      <div className="flex gap-3">
        <Row label="Outline">
          <input
            type="color"
            value={text.strokeColor ?? '#000000'}
            onChange={(e) => set({ strokeColor: e.target.value }, `sk:${clip.id}`)}
            className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
          />
        </Row>
        <Row label={`Width · ${text.strokeWidth ?? 0}px`}>
          <Slider value={[text.strokeWidth ?? 0]} min={0} max={20} step={1} onValueChange={(v) => set({ strokeWidth: sv(v) }, `skw:${clip.id}`)} />
        </Row>
      </div>
      <div className="flex gap-3">
        <Row label="Shadow">
          <input
            type="color"
            value={text.shadowColor ?? '#000000'}
            onChange={(e) => set({ shadowColor: e.target.value }, `sh:${clip.id}`)}
            className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
          />
        </Row>
        <Row label={`Blur · ${text.shadowBlur ?? 0}px`}>
          <Slider value={[text.shadowBlur ?? 0]} min={0} max={40} step={1} onValueChange={(v) => set({ shadowBlur: sv(v), shadowOffsetY: text.shadowOffsetY ?? 2 }, `shb:${clip.id}`)} />
        </Row>
      </div>
      <Row label={`Letter spacing · ${text.letterSpacing ?? 0}px`}>
        <Slider value={[text.letterSpacing ?? 0]} min={-10} max={40} step={1} onValueChange={(v) => set({ letterSpacing: sv(v) }, `ls:${clip.id}`)} />
      </Row>
      <Row label={`Line height · ${(text.lineHeight ?? 1.2).toFixed(2)}`}>
        <Slider value={[text.lineHeight ?? 1.2]} min={0.8} max={2.5} step={0.05} onValueChange={(v) => set({ lineHeight: sv(v) }, `lh:${clip.id}`)} />
      </Row>
      {text.background && (
        <Row label={`Box radius · ${text.bgRadius ?? 0}px`}>
          <Slider value={[text.bgRadius ?? 0]} min={0} max={60} step={1} onValueChange={(v) => set({ bgRadius: sv(v) }, `br:${clip.id}`)} />
        </Row>
      )}
    </>
  )
}

const REFRAME_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '16:9', w: 1920, h: 1080 },
  { label: '9:16', w: 1080, h: 1920 },
  { label: '1:1', w: 1080, h: 1080 },
  { label: '4:5', w: 1080, h: 1350 },
]

function BrandKitControls({ text, onApply }: { text: TextProperties; onApply: (patch: Partial<TextProperties>) => void }) {
  const [kit, setKit] = useState(() => getBrandKit())
  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <Label className="text-xs font-semibold text-foreground">Brand kit</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setKit(addBrandColor(text.color))}
            className="text-[10px] text-muted-foreground hover:text-foreground"
            title="Save this text colour to the brand kit"
          >
            + Save color
          </button>
          <button
            onClick={() => setKit(setBrandFont(text.fontFamily))}
            className="text-[10px] text-muted-foreground hover:text-foreground"
            title="Set this font as the brand font"
          >
            Set font
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {kit.colors.map((c) => (
          <button
            key={c}
            onClick={() => onApply({ color: c })}
            onContextMenu={(e) => {
              e.preventDefault()
              setKit(removeBrandColor(c))
            }}
            aria-label={`Apply brand colour ${c} (right-click to remove)`}
            title={`${c} — click to apply, right-click to remove`}
            className="size-6 rounded-md border border-border"
            style={{ background: c }}
          />
        ))}
        {kit.fontFamily && (
          <button
            onClick={() => onApply({ fontFamily: kit.fontFamily })}
            className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
            style={{ fontFamily: kit.fontFamily }}
            title="Apply brand font"
          >
            Brand font
          </button>
        )}
      </div>
    </>
  )
}

function ProjectProps() {
  const project = useEditorStore((s) => s.project)
  const updateProject = useEditorStore((s) => s.updateProject)
  const reframe = useEditorStore((s) => s.reframe)
  if (!project) return null
  const ratio = project.width / project.height
  return (
    <>
      <Row label="Resolution">
        <div className="text-sm text-muted-foreground">
          {project.width} × {project.height} · {project.fps}fps
        </div>
      </Row>
      <Row label="Auto-reframe">
        <div className="grid grid-cols-4 gap-1.5">
          {REFRAME_PRESETS.map((r) => {
            const active = Math.abs(r.w / r.h - ratio) < 0.01
            return (
              <button
                key={r.label}
                onClick={() => reframe(r.w, r.h)}
                className={cn(
                  'rounded-md border py-1.5 text-xs transition-colors',
                  active ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <p className="pt-1 text-[10px] text-muted-foreground">Changes the canvas aspect and fills clips to cover the new frame.</p>
      </Row>
      <Row label="Background">
        <input
          type="color"
          value={project.background}
          onChange={(e) => updateProject({ background: e.target.value }, 'project-bg')}
          className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
        />
      </Row>
      <p className="pt-2 text-xs text-muted-foreground">
        Select a clip on the timeline to edit its properties.
      </p>
    </>
  )
}

function Toggle({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'rounded-md border border-border p-1.5 transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** base-ui Slider passes a number or an array depending on its value shape. */
function sv(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number)
}
