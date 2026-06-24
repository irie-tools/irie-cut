import { useEffect, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { Slider } from '#/components/ui/slider'
import { useEditorStore, projectDuration } from '#/stores/editor-store'
import { drawFrame, clipActiveAt, type RenderSources } from '#/lib/renderer'
import { formatTimecode } from '#/lib/media'
import { effectiveGain, anySolo } from '#/lib/audio'
import type { Project } from '#/types/editor'

export function PreviewPanel() {
  const project = useEditorStore((s) => s.project)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoEls = useRef(new Map<string, HTMLVideoElement>())
  const audioEls = useRef(new Map<string, HTMLAudioElement>())
  const imageEls = useRef(new Map<string, HTMLImageElement>())

  // Continuous render + media-sync loop while the panel is mounted.
  useEffect(() => {
    let raf = 0
    const sources: RenderSources = {
      getVideo: (id) => videoEls.current.get(id),
      getImage: (id) => imageEls.current.get(id),
    }

    const loop = () => {
      const state = useEditorStore.getState()
      const p = state.project
      const canvas = canvasRef.current
      if (p && canvas) {
        if (canvas.width !== p.width || canvas.height !== p.height) {
          canvas.width = p.width
          canvas.height = p.height
        }
        syncMedia(p, state.currentTime, state.isPlaying, state.getMediaUrl, {
          videoEls: videoEls.current,
          audioEls: audioEls.current,
          imageEls: imageEls.current,
        })
        const ctx = canvas.getContext('2d')
        if (ctx) drawFrame(ctx, p, state.currentTime, sources)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const vids = videoEls.current
    const auds = audioEls.current
    const imgs = imageEls.current
    return () => {
      cancelAnimationFrame(raf)
      vids.forEach((v) => v.pause())
      auds.forEach((a) => a.pause())
      vids.clear()
      auds.clear()
      imgs.clear()
    }
  }, [])

  const hasClips = project?.tracks.some((t) => t.clips.length) ?? false

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,oklch(0.17_0.008_245),oklch(0.12_0.006_245))] p-5">
        {project ? (
          <canvas
            ref={canvasRef}
            style={{ aspectRatio: `${project.width} / ${project.height}` }}
            className="max-h-full max-w-full rounded-md bg-black shadow-2xl ring-1 ring-white/10"
          />
        ) : null}
        {project && !hasClips && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">Your canvas is empty</p>
            <p className="text-xs text-muted-foreground/70">
              Import media or add a clip to start cutting
            </p>
          </div>
        )}
      </div>
      <Transport />
    </div>
  )
}

function Transport() {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const currentTime = useEditorStore((s) => s.currentTime)
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime)
  const project = useEditorStore((s) => s.project)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  const total = projectDuration(project)

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border px-4 py-2">
      <button
        onClick={() => {
          setPlaying(false)
          setCurrentTime(0)
        }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Skip to start"
      >
        <SkipBack className="size-4" />
      </button>
      <button
        onClick={togglePlay}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
      <button
        onClick={() => {
          setPlaying(false)
          setCurrentTime(total)
        }}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Skip to end"
      >
        <SkipForward className="size-4" />
      </button>
      <div className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTimecode(currentTime)} / {formatTimecode(total)}
      </div>
      <MasterVolume />
    </div>
  )
}

function MasterVolume() {
  const master = useEditorStore((s) => s.project?.masterVolume ?? 1)
  const updateProject = useEditorStore((s) => s.updateProject)
  const muted = master === 0
  return (
    <div className="ml-2 flex items-center gap-2" title="Master volume">
      <button
        onClick={() => updateProject({ masterVolume: muted ? 1 : 0 })}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
      <Slider
        value={[master]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) =>
          updateProject({ masterVolume: Array.isArray(v) ? v[0] : (v as number) }, 'master-vol')
        }
        className="w-24"
      />
    </div>
  )
}

interface ElMaps {
  videoEls: Map<string, HTMLVideoElement>
  audioEls: Map<string, HTMLAudioElement>
  imageEls: Map<string, HTMLImageElement>
}

/** Reconcile media elements with the project and sync playback to `time`. */
function syncMedia(
  project: Project,
  time: number,
  playing: boolean,
  getUrl: (id: string) => string | undefined,
  maps: ElMaps,
) {
  const neededVideo = new Set<string>()
  const neededAudio = new Set<string>()
  const neededImage = new Set<string>()
  const soloActive = anySolo(project)

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.type === 'image' && clip.mediaId) {
        neededImage.add(clip.mediaId)
        if (!maps.imageEls.has(clip.mediaId)) {
          const url = getUrl(clip.mediaId)
          if (url) {
            const img = new Image()
            img.src = url
            maps.imageEls.set(clip.mediaId, img)
          }
        }
        continue
      }
      if (clip.type !== 'video' && clip.type !== 'audio') continue
      if (!clip.mediaId) continue
      const map = clip.type === 'video' ? maps.videoEls : maps.audioEls
      const needed = clip.type === 'video' ? neededVideo : neededAudio
      needed.add(clip.id)

      let el = map.get(clip.id) as HTMLVideoElement | HTMLAudioElement | undefined
      if (!el) {
        const url = getUrl(clip.mediaId)
        if (!url) continue
        el = clip.type === 'video' ? document.createElement('video') : document.createElement('audio')
        el.src = url
        el.preload = 'auto'
        ;(el as HTMLVideoElement).playsInline = true
        map.set(clip.id, el as never)
      }

      const active = clipActiveAt(clip, time)
      const speed = clip.speed ?? 1
      const target = clip.trimStart + (time - clip.start) * speed
      el.muted = false
      el.volume = effectiveGain(project, track, clip, time, soloActive)
      if (el.playbackRate !== speed) el.playbackRate = speed

      if (active) {
        if (playing) {
          if (Math.abs(el.currentTime - target) > 0.25 && Number.isFinite(target)) {
            try {
              el.currentTime = target
            } catch {
              /* not seekable yet */
            }
          }
          if (el.paused) void el.play().catch(() => {})
        } else {
          if (!el.paused) el.pause()
          if (Math.abs(el.currentTime - target) > 0.05 && Number.isFinite(target)) {
            try {
              el.currentTime = target
            } catch {
              /* not seekable yet */
            }
          }
        }
      } else if (!el.paused) {
        el.pause()
      }
    }
  }

  // Drop elements for clips/media that no longer exist.
  prune(maps.videoEls, neededVideo)
  prune(maps.audioEls, neededAudio)
  prune(maps.imageEls, neededImage)
}

function prune<T extends HTMLMediaElement | HTMLImageElement>(
  map: Map<string, T>,
  needed: Set<string>,
) {
  for (const [key, el] of map) {
    if (!needed.has(key)) {
      if ('pause' in el) (el as HTMLMediaElement).pause()
      map.delete(key)
    }
  }
}
