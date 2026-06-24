import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useEditorStore } from '#/stores/editor-store'
import type { Clip, TextProperties } from '#/types/editor'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Slider } from '#/components/ui/slider'
import { ScrollArea } from '#/components/ui/scroll-area'
import { cn } from '#/lib/utils'
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
    <div className="flex h-full flex-col border-l border-border bg-card/30">
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

function TransformControls({ clip }: { clip: Clip }) {
  const updateClip = useEditorStore((s) => s.updateClip)
  const tr = clip.transform ?? DEFAULT_TRANSFORM
  const set = (patch: Partial<typeof DEFAULT_TRANSFORM>, key: string) =>
    updateClip(clip.id, { transform: { ...tr, ...patch } }, `${key}:${clip.id}`)

  return (
    <>
      <Row label={`Scale · ${Math.round(tr.scale * 100)}%`}>
        <Slider value={[tr.scale]} min={0.1} max={3} step={0.01} onValueChange={(v) => set({ scale: sv(v) }, 'sc')} />
      </Row>
      <Row label={`Opacity · ${Math.round(tr.opacity * 100)}%`}>
        <Slider value={[tr.opacity]} min={0} max={1} step={0.01} onValueChange={(v) => set({ opacity: sv(v) }, 'op')} />
      </Row>
      <Row label={`Rotation · ${Math.round(tr.rotation)}°`}>
        <Slider value={[tr.rotation]} min={-180} max={180} step={1} onValueChange={(v) => set({ rotation: sv(v) }, 'rot')} />
      </Row>
      <div className="flex gap-3">
        <Row label={`X · ${Math.round(tr.x * 100)}%`}>
          <Slider value={[tr.x]} min={-1} max={1} step={0.01} onValueChange={(v) => set({ x: sv(v) }, 'px')} />
        </Row>
        <Row label={`Y · ${Math.round(tr.y * 100)}%`}>
          <Slider value={[tr.y]} min={-1} max={1} step={0.01} onValueChange={(v) => set({ y: sv(v) }, 'py')} />
        </Row>
      </div>
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
