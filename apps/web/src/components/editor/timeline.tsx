import { useRef } from 'react'
import {
  Scissors,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  Video,
  Music,
  Type,
  Image as ImageIcon,
} from 'lucide-react'
import {
  useEditorStore,
  projectDuration,
  PX_PER_SECOND_BASE,
} from '#/stores/editor-store'
import type { Clip, Track } from '#/types/editor'
import { cn } from '#/lib/utils'

export function Timeline() {
  const project = useEditorStore((s) => s.project)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const selectedClipId = useEditorStore((s) => s.selectedClipId)
  const selectClip = useEditorStore((s) => s.selectClip)
  const splitAtPlayhead = useEditorStore((s) => s.splitAtPlayhead)
  const deleteClip = useEditorStore((s) => s.deleteClip)
  const duplicateClip = useEditorStore((s) => s.duplicateClip)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (!project) return null

  const pps = PX_PER_SECOND_BASE * zoom
  const total = projectDuration(project)
  const contentSeconds = Math.max(total + 5, 20)
  const contentWidth = contentSeconds * pps

  function timeFromEvent(clientX: number): number {
    const el = scrollRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft
    return Math.max(0, x / pps)
  }

  function onRulerDown(e: React.PointerEvent) {
    setCurrentTime(timeFromEvent(e.clientX))
    const move = (ev: PointerEvent) => setCurrentTime(timeFromEvent(ev.clientX))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-card/30">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <ToolBtn label="Split (S)" onClick={splitAtPlayhead} disabled={!selectedClipId}>
          <Scissors className="size-4" />
        </ToolBtn>
        <ToolBtn
          label="Duplicate"
          onClick={() => selectedClipId && duplicateClip(selectedClipId)}
          disabled={!selectedClipId}
        >
          <Copy className="size-4" />
        </ToolBtn>
        <ToolBtn
          label="Delete (Del)"
          onClick={() => selectedClipId && deleteClip(selectedClipId)}
          disabled={!selectedClipId}
        >
          <Trash2 className="size-4" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <AddTrackButtons />
        <div className="ml-auto flex items-center gap-1">
          <ToolBtn label="Zoom out" onClick={() => setZoom(zoom / 1.3)}>
            <ZoomOut className="size-4" />
          </ToolBtn>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn label="Zoom in" onClick={() => setZoom(zoom * 1.3)}>
            <ZoomIn className="size-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div style={{ width: contentWidth }} className="relative">
          <Ruler seconds={contentSeconds} pps={pps} onPointerDown={onRulerDown} />

          <div className="relative">
            {project.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                pps={pps}
                selectedClipId={selectedClipId}
                onSelect={selectClip}
                timeFromEvent={timeFromEvent}
              />
            ))}
          </div>

          {/* Playhead spanning ruler + tracks */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary"
            style={{ left: currentTime * pps }}
          >
            <div className="absolute -left-[5px] top-0 size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Ruler({
  seconds,
  pps,
  onPointerDown,
}: {
  seconds: number
  pps: number
  onPointerDown: (e: React.PointerEvent) => void
}) {
  // Choose a tick interval that keeps labels ~70px apart.
  const minLabelPx = 70
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300]
  const step = candidates.find((c) => c * pps >= minLabelPx) ?? 600
  const ticks: number[] = []
  for (let t = 0; t <= seconds; t += step) ticks.push(t)

  return (
    <div
      onPointerDown={onPointerDown}
      className="relative h-7 cursor-text border-b border-border bg-background/40 select-none"
    >
      {ticks.map((t) => (
        <div key={t} className="absolute top-0 h-full" style={{ left: t * pps }}>
          <div className="absolute top-0 h-2 w-px bg-border" />
          <span className="absolute left-1 top-1.5 text-[10px] tabular-nums text-muted-foreground">
            {formatTick(t)}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatTick(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}

const TRACK_ICON = { video: Video, audio: Music, text: Type } as const

function TrackRow({
  track,
  pps,
  selectedClipId,
  onSelect,
  timeFromEvent,
}: {
  track: Track
  pps: number
  selectedClipId: string | null
  onSelect: (id: string | null) => void
  timeFromEvent: (clientX: number) => number
}) {
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia)
  const Icon = TRACK_ICON[track.type]

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const mediaId = e.dataTransfer.getData('application/x-irie-cut-media')
    if (mediaId) addClipFromMedia(mediaId, timeFromEvent(e.clientX))
  }

  return (
    <div
      className="relative h-14 border-b border-border/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="pointer-events-none absolute left-1 top-1 z-10 flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <Icon className="size-3" />
      </div>
      {track.clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          pps={pps}
          selected={clip.id === selectedClipId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

const CLIP_COLORS: Record<Clip['type'], string> = {
  video: 'bg-sky-600/80 border-sky-400',
  image: 'bg-violet-600/80 border-violet-400',
  audio: 'bg-emerald-600/80 border-emerald-400',
  text: 'bg-amber-500/80 border-amber-300',
}

function ClipView({
  clip,
  pps,
  selected,
  onSelect,
}: {
  clip: Clip
  pps: number
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const left = clip.start * pps
  const width = Math.max(8, clip.duration * pps)
  const ClipIcon = clip.type === 'image' ? ImageIcon : TRACK_ICON[clip.type === 'text' ? 'text' : clip.type === 'audio' ? 'audio' : 'video']

  function beginDrag(e: React.PointerEvent, kind: 'move' | 'trim-l' | 'trim-r') {
    e.preventDefault()
    e.stopPropagation()
    onSelect(clip.id)
    const store = useEditorStore.getState()
    const asset = clip.mediaId ? store.media.find((m) => m.id === clip.mediaId) : undefined
    const sourceMax = asset && asset.type !== 'image' ? asset.duration : Infinity
    const startX = e.clientX
    const o = {
      start: clip.start,
      duration: clip.duration,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    }

    const move = (ev: PointerEvent) => {
      const ds = (ev.clientX - startX) / pps
      const s = useEditorStore.getState()
      if (kind === 'move') {
        s.updateClip(clip.id, { start: Math.max(0, o.start + ds) })
      } else if (kind === 'trim-l') {
        const maxLeft = o.duration - 0.1
        const delta = Math.min(Math.max(ds, -o.trimStart), maxLeft)
        s.updateClip(clip.id, {
          start: Math.max(0, o.start + delta),
          duration: o.duration - delta,
          trimStart: o.trimStart + delta,
        })
      } else {
        let newDur = Math.max(0.1, o.duration + ds)
        if (Number.isFinite(sourceMax)) {
          newDur = Math.min(newDur, sourceMax - o.trimStart)
        }
        s.updateClip(clip.id, { duration: newDur, trimEnd: o.trimStart + newDur })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      onPointerDown={(e) => beginDrag(e, 'move')}
      className={cn(
        'group absolute top-1.5 bottom-1.5 cursor-grab overflow-hidden rounded-md border text-white active:cursor-grabbing',
        CLIP_COLORS[clip.type],
        selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
      )}
      style={{ left, width }}
    >
      <div className="flex h-full items-center gap-1 px-2">
        <ClipIcon className="size-3 shrink-0 opacity-80" />
        <span className="truncate text-[11px] font-medium">
          {clip.type === 'text' ? clip.text?.content || 'Text' : clip.name}
        </span>
      </div>
      {/* Trim handles */}
      <div
        onPointerDown={(e) => beginDrag(e, 'trim-l')}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
      <div
        onPointerDown={(e) => beginDrag(e, 'trim-r')}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
    </div>
  )
}

function AddTrackButtons() {
  const addTrack = useEditorStore((s) => s.addTrack)
  return (
    <>
      <ToolBtn label="Add video track" onClick={() => addTrack('video')}>
        <Video className="size-4" />
      </ToolBtn>
      <ToolBtn label="Add audio track" onClick={() => addTrack('audio')}>
        <Music className="size-4" />
      </ToolBtn>
    </>
  )
}

function ToolBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}
