import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useEditorStore } from '#/stores/editor-store'
import type { Clip, TextProperties } from '#/types/editor'
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
  type KeyframeProp,
} from '#/lib/keyframes'
import { FILTER_PRESETS } from '#/lib/filters'
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

      {(clip.type === 'video' || clip.type === 'audio') && (
        <Row label={`Volume · ${Math.round(clip.volume * 100)}%`}>
          <Slider
            value={[clip.volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(v) => updateClip(clip.id, { volume: sv(v) }, `vol:${clip.id}`)}
          />
        </Row>
      )}

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

      {(clip.type === 'video' || clip.type === 'image') && <TransformControls clip={clip} />}

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

function TransformControls({ clip }: { clip: Clip }) {
  const clearKeyframes = useEditorStore((s) => s.clearKeyframes)
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

function TextProps({ clip, text }: { clip: Clip; text: TextProperties }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const set = (patch: Partial<TextProperties>, coalesceKey?: string) =>
    updateClip(clip.id, { text: { ...text, ...patch } }, coalesceKey)

  return (
    <>
      <Row label="Text">
        <Textarea
          value={text.content}
          rows={2}
          onChange={(e) => set({ content: e.target.value }, `txt:${clip.id}`)}
        />
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
    </>
  )
}

function ProjectProps() {
  const project = useEditorStore((s) => s.project)
  const updateProject = useEditorStore((s) => s.updateProject)
  if (!project) return null
  return (
    <>
      <Row label="Resolution">
        <div className="text-sm text-muted-foreground">
          {project.width} × {project.height} · {project.fps}fps
        </div>
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
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
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
