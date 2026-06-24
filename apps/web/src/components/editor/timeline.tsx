import { useRef, useState } from 'react'
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
  Shapes,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Delete,
  Flag,
  Maximize2,
} from 'lucide-react'
import {
  useEditorStore,
  projectDuration,
  PX_PER_SECOND_BASE,
} from '#/stores/editor-store'
import type { Clip, Track } from '#/types/editor'
import { cn } from '#/lib/utils'
import { keyframeTimes } from '#/lib/keyframes'
import { roleLabel } from '#/lib/beats'
import { Slider } from '#/components/ui/slider'
import { useWaveform } from '#/hooks/use-waveform'

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
  const rippleDeleteClip = useEditorStore((s) => s.rippleDeleteClip)
  const duplicateClip = useEditorStore((s) => s.duplicateClip)
  const addMarker = useEditorStore((s) => s.addMarker)
  const removeMarker = useEditorStore((s) => s.removeMarker)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [snapTime, setSnapTime] = useState<number | null>(null)

  if (!project) return null

  const pps = PX_PER_SECOND_BASE * zoom
  const total = projectDuration(project)
  const contentSeconds = Math.max(total + 5, 20)
  const contentWidth = contentSeconds * pps

  function zoomToFit() {
    const el = scrollRef.current
    if (!el || total <= 0) return
    setZoom((el.clientWidth - 24) / (total * PX_PER_SECOND_BASE))
  }

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
    <div className="flex h-full flex-col border-t border-border bg-card">
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
        <ToolBtn
          label="Ripple delete (close gap)"
          onClick={() => selectedClipId && rippleDeleteClip(selectedClipId)}
          disabled={!selectedClipId}
        >
          <Delete className="size-4" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <AddTrackButtons />
        <ToolBtn label="Add marker (M)" onClick={() => addMarker(currentTime)}>
          <Flag className="size-4" />
        </ToolBtn>
        <div className="ml-auto flex items-center gap-1">
          <ToolBtn label="Zoom to fit" onClick={zoomToFit}>
            <Maximize2 className="size-4" />
          </ToolBtn>
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

      {/* Body: fixed track-header gutter + horizontally scrollable lanes */}
      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        {total <= 0 && (
          <div className="pointer-events-none absolute inset-y-0 left-40 right-0 z-30 flex items-center justify-center">
            <p className="rounded-full bg-card/80 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
              Click <span className="text-foreground">+ Add</span> on a media item, or drag it onto a track
            </p>
          </div>
        )}
        <div className="w-40 shrink-0 border-r border-border bg-card/40">
          <div className="h-7 border-b border-border" />
          {project.tracks.map((track, i) => (
            <TrackHeader key={track.id} track={track} index={i} total={project.tracks.length} />
          ))}
        </div>

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-x-auto bg-[oklch(0.15_0.006_245)]"
        >
          <div style={{ width: contentWidth }} className="relative">
            <Ruler
              seconds={contentSeconds}
              pps={pps}
              onPointerDown={onRulerDown}
              markers={project.markers ?? []}
              onRemoveMarker={removeMarker}
            />

            <div className="relative">
              {project.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  pps={pps}
                  selectedClipId={selectedClipId}
                  onSelect={selectClip}
                  timeFromEvent={timeFromEvent}
                  onSnap={setSnapTime}
                />
              ))}
            </div>

            {/* Snap guide while dragging */}
            {snapTime != null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary/80 shadow-[0_0_5px_var(--color-primary)]"
                style={{ left: snapTime * pps }}
              />
            )}

            {/* Playhead spanning ruler + tracks */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-primary shadow-[0_0_6px_var(--color-primary)]"
              style={{ left: currentTime * pps }}
            >
              <div className="absolute -left-[5px] -top-px size-2.5 -translate-x-px rotate-45 rounded-[2px] bg-primary shadow-[0_0_6px_var(--color-primary)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackHeader({ track, index, total }: { track: Track; index: number; total: number }) {
  const updateTrack = useEditorStore((s) => s.updateTrack)
  const removeTrack = useEditorStore((s) => s.removeTrack)
  const moveTrack = useEditorStore((s) => s.moveTrack)
  const Icon = TRACK_ICON[track.type]
  const hasAudio = track.type === 'video' || track.type === 'audio'
  const vol = track.volume ?? 1

  return (
    <div className="group/th flex h-14 flex-col justify-center gap-1 border-b border-border/60 px-2 py-1">
      <div className="flex items-center gap-1">
        <Icon className="size-3 shrink-0 text-muted-foreground" />
        <input
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          className="min-w-0 flex-1 truncate bg-transparent text-[11px] font-medium outline-none"
        />
        <button
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
          title="Mute"
          className={cn(
            'rounded px-1 text-[9px] font-bold',
            track.muted ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          M
        </button>
        <button
          onClick={() => updateTrack(track.id, { solo: !track.solo })}
          title="Solo"
          className={cn(
            'rounded px-1 text-[9px] font-bold',
            track.solo ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          S
        </button>
        <button
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
          title={track.locked ? 'Unlock' : 'Lock'}
          className="text-muted-foreground hover:text-foreground"
        >
          {track.locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
        </button>
      </div>
      {hasAudio ? (
        <Slider
          value={[vol]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) =>
            updateTrack(track.id, { volume: Array.isArray(v) ? v[0] : (v as number) })
          }
        />
      ) : (
        <div className="h-3" />
      )}
      <div className="flex items-center gap-1 opacity-0 transition group-hover/th:opacity-100">
        <button
          onClick={() => moveTrack(track.id, -1)}
          disabled={index === 0}
          title="Move up"
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          onClick={() => moveTrack(track.id, 1)}
          disabled={index === total - 1}
          title="Move down"
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="size-3" />
        </button>
        <button
          onClick={() => removeTrack(track.id)}
          title="Delete track"
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

function Ruler({
  seconds,
  pps,
  onPointerDown,
  markers,
  onRemoveMarker,
}: {
  seconds: number
  pps: number
  onPointerDown: (e: React.PointerEvent) => void
  markers: { id: string; time: number; label: string }[]
  onRemoveMarker: (id: string) => void
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
      {markers.map((m) => (
        <button
          key={m.id}
          title={`Marker @ ${formatTick(m.time)} — click to remove`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemoveMarker(m.id)}
          className="absolute bottom-0 z-10 -translate-x-1/2"
          style={{ left: m.time * pps }}
        >
          <Flag className="size-3 fill-rose-500 text-rose-500" />
        </button>
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
  onSnap,
}: {
  track: Track
  pps: number
  selectedClipId: string | null
  onSelect: (id: string | null) => void
  timeFromEvent: (clientX: number) => number
  onSnap: (t: number | null) => void
}) {
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia)

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
      {track.clips.map((clip) => (
        <ClipView
          key={clip.id}
          clip={clip}
          pps={pps}
          selected={clip.id === selectedClipId}
          onSelect={onSelect}
          locked={!!track.locked}
          onSnap={onSnap}
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
  shape: 'bg-pink-600/80 border-pink-400',
}

function ClipView({
  clip,
  pps,
  selected,
  onSelect,
  locked,
  onSnap,
}: {
  clip: Clip
  pps: number
  selected: boolean
  onSelect: (id: string | null) => void
  locked: boolean
  onSnap: (t: number | null) => void
}) {
  const left = clip.start * pps
  const width = Math.max(8, clip.duration * pps)
  const ClipIcon = clip.type === 'image' ? ImageIcon : clip.type === 'shape' ? Shapes : TRACK_ICON[clip.type === 'text' ? 'text' : clip.type === 'audio' ? 'audio' : 'video']
  const asset = useEditorStore((s) => (clip.mediaId ? s.media.find((m) => m.id === clip.mediaId) : undefined))
  const peaks = useWaveform(clip.type === 'audio' ? clip.mediaId : undefined)
  const thumb = asset?.thumbnail
  const kfTimes = Array.from(
    new Set([...keyframeTimes(clip), ...(clip.volumeKeyframes ?? []).map((k) => k.t)]),
  ).sort((a, b) => a - b)
  const fadeInW = (clip.fadeIn ?? 0) > 0 ? Math.min(width, ((clip.fadeIn ?? 0) / clip.duration) * width) : 0
  const fadeOutW = (clip.fadeOut ?? 0) > 0 ? Math.min(width, ((clip.fadeOut ?? 0) / clip.duration) * width) : 0

  function beginDrag(e: React.PointerEvent, kind: 'move' | 'trim-l' | 'trim-r') {
    e.preventDefault()
    e.stopPropagation()
    onSelect(clip.id)
    if (locked) return
    const store = useEditorStore.getState()
    const asset = clip.mediaId ? store.media.find((m) => m.id === clip.mediaId) : undefined
    const speed = clip.speed ?? 1
    const sourceMax = asset && asset.type !== 'image' ? asset.duration / speed : Infinity
    const startX = e.clientX
    const o = {
      start: clip.start,
      duration: clip.duration,
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    }

    // Snap targets: timeline origin, playhead, other clips' edges, and markers (beats).
    const snapPoints = [0, store.currentTime]
    for (const t of store.project?.tracks ?? []) {
      for (const c of t.clips) {
        if (c.id === clip.id) continue
        snapPoints.push(c.start, c.start + c.duration)
      }
    }
    for (const m of store.project?.markers ?? []) snapPoints.push(m.time)
    const snapThreshold = 8 / pps
    const snap = (v: number) => {
      let best = v
      let bestD = snapThreshold
      for (const p of snapPoints) {
        const d = Math.abs(v - p)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      return best
    }

    const ck = `${kind}:${clip.id}`
    const move = (ev: PointerEvent) => {
      const ds = (ev.clientX - startX) / pps
      const s = useEditorStore.getState()
      if (kind === 'move') {
        const rawStart = Math.max(0, o.start + ds)
        // Snap the leading edge, or the trailing edge if it's closer.
        const snappedStart = snap(rawStart)
        const snappedEnd = snap(rawStart + o.duration) - o.duration
        const useStart = Math.abs(snappedStart - rawStart) <= Math.abs(snappedEnd - rawStart)
        const start = Math.max(0, useStart ? snappedStart : snappedEnd)
        s.updateClip(clip.id, { start }, ck)
        const startSnapped = useStart && Math.abs(snappedStart - rawStart) > 1e-6
        const endSnapped = !useStart && Math.abs(snappedEnd - rawStart) > 1e-6
        onSnap(startSnapped ? start : endSnapped ? start + o.duration : null)
      } else if (kind === 'trim-l') {
        const maxLeft = o.duration - 0.1
        const delta = Math.min(Math.max(ds, -o.trimStart), maxLeft)
        s.updateClip(
          clip.id,
          {
            start: Math.max(0, o.start + delta),
            duration: o.duration - delta,
            trimStart: o.trimStart + delta,
          },
          ck,
        )
      } else {
        let newDur = Math.max(0.1, o.duration + ds)
        if (Number.isFinite(sourceMax)) {
          newDur = Math.min(newDur, sourceMax - o.trimStart)
        }
        s.updateClip(clip.id, { duration: newDur, trimEnd: o.trimStart + newDur }, ck)
      }
    }
    const up = () => {
      onSnap(null)
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
        'group absolute top-1.5 bottom-1.5 cursor-grab overflow-hidden rounded-lg border text-white shadow-sm transition-[filter,box-shadow] hover:brightness-110 active:cursor-grabbing',
        CLIP_COLORS[clip.type],
        selected
          ? 'z-10 ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20'
          : 'border-white/10',
      )}
      style={{ left, width }}
    >
      {/* Media background: filmstrip for video, cover for image */}
      {(clip.type === 'video' || clip.type === 'image') && thumb && (
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage: `url(${thumb})`,
            backgroundRepeat: clip.type === 'video' ? 'repeat-x' : 'no-repeat',
            backgroundSize: clip.type === 'video' ? 'auto 100%' : 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {clip.type === 'audio' && peaks && <Waveform peaks={slicePeaks(peaks, clip, asset?.duration)} />}

      <div className="relative flex h-full items-center gap-1 bg-gradient-to-r from-black/55 via-black/20 to-transparent px-2">
        <ClipIcon className="size-3 shrink-0 opacity-80" />
        <span className="truncate text-[11px] font-medium drop-shadow">
          {clip.type === 'text' ? clip.text?.content || 'Text' : clip.name}
        </span>
        {roleLabel(clip.role) && (
          <span className="ml-auto shrink-0 rounded bg-black/40 px-1 text-[9px] font-semibold uppercase tracking-wide">
            {roleLabel(clip.role)}
          </span>
        )}
      </div>
      {/* Audio fade ramps */}
      {fadeInW > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{ width: fadeInW, background: 'linear-gradient(to top right, rgba(0,0,0,0.6), transparent 65%)' }}
        />
      )}
      {fadeOutW > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{ width: fadeOutW, background: 'linear-gradient(to top left, rgba(0,0,0,0.6), transparent 65%)' }}
        />
      )}
      {/* Trim handles */}
      <div
        onPointerDown={(e) => beginDrag(e, 'trim-l')}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
      <div
        onPointerDown={(e) => beginDrag(e, 'trim-r')}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
      />
      {/* Keyframe markers along the bottom: click to jump the playhead to one.
          Rendered after the trim handles with z-20 so edge keyframes stay clickable. */}
      {kfTimes.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0.5 z-20 h-2">
          {kfTimes.map((t) => (
            <button
              key={t}
              onPointerDown={(e) => {
                e.stopPropagation()
                useEditorStore.getState().setCurrentTime(clip.start + t)
              }}
              title="Keyframe — jump playhead here"
              className="pointer-events-auto absolute top-0 size-1.5 -translate-x-1/2 rotate-45 border border-black/40 bg-white/90 shadow-sm hover:bg-white"
              style={{ left: clip.duration > 0 ? (t / clip.duration) * width : 0 }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Slice full-source peaks down to the clip's trimmed region. */
function slicePeaks(peaks: number[], clip: Clip, sourceDuration: number | undefined): number[] {
  if (!sourceDuration) return peaks
  const a = Math.max(0, Math.floor((clip.trimStart / sourceDuration) * peaks.length))
  const b = Math.min(peaks.length, Math.ceil((clip.trimEnd / sourceDuration) * peaks.length))
  const sliced = peaks.slice(a, b)
  return sliced.length ? sliced : peaks
}

function Waveform({ peaks }: { peaks: number[] }) {
  const n = peaks.length
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-white/45"
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {peaks.map((p, i) => (
        <rect key={i} x={i + 0.1} width={0.8} y={50 - p * 46} height={Math.max(1, p * 92)} fill="currentColor" />
      ))}
    </svg>
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
