import { useState } from 'react'
import { Download, Loader2, Captions as CaptionsIcon, ListTree } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Progress } from '#/components/ui/progress'
import { useEditorStore, projectDuration } from '#/stores/editor-store'
import { exportProject } from '#/lib/exporter'
import { exportProjectWebCodecs, webCodecsSupported } from '#/lib/exporter-webcodecs'
import * as storage from '#/lib/storage'
import { formatTimecode } from '#/lib/media'
import { cn } from '#/lib/utils'
import { buildSrt, buildVtt, buildCues } from '#/lib/captions'
import { buildEdl, buildCutdown, beatSummary } from '#/lib/beats'

type Phase = 'idle' | 'exporting' | 'done' | 'error'

export function ExportButton() {
  const project = useEditorStore((s) => s.project)
  const getMediaUrl = useEditorStore((s) => s.getMediaUrl)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const wcSupported = webCodecsSupported()
  const [engine, setEngine] = useState<'webcodecs' | 'realtime'>(wcSupported ? 'webcodecs' : 'realtime')

  const total = projectDuration(project)
  const empty = total <= 0
  const cueCount = project ? buildCues(project).length : 0

  const beats = project ? beatSummary(project) : { counts: {}, sequence: [] }
  const taggedCount = beats.sequence.length

  function download(content: string, ext: string, mime: string) {
    if (!project) return
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitize(project.name)}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function downloadCaptions(kind: 'srt' | 'vtt') {
    if (!project) return
    download(kind === 'srt' ? buildSrt(project) : buildVtt(project), kind, 'text/plain;charset=utf-8')
  }

  function downloadEdl() {
    if (!project) return
    download(JSON.stringify(buildEdl(project), null, 2), 'edl.json', 'application/json')
  }

  function downloadCutdown() {
    if (!project) return
    download(JSON.stringify(buildCutdown(project), null, 2), 'cutdown.json', 'application/json')
  }

  async function run() {
    if (!project) return
    setPlaying(false)
    setPhase('exporting')
    setProgress(0)
    setError('')
    try {
      const onP = (f: number) => setProgress(Math.round(f * 100))
      const { blob, extension } =
        engine === 'webcodecs' && wcSupported
          ? await exportProjectWebCodecs(project, getMediaUrl, (id) => storage.getMediaBlob(id), onP, {})
          : await exportProject(project, getMediaUrl, onP)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitize(project.name)}.${extension}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
      setPhase('error')
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={empty}
        className="bg-gradient-to-b from-primary to-primary/80 shadow-sm shadow-primary/30 hover:to-primary"
      >
        <Download className="size-4" /> Export
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (phase === 'exporting') return
          setOpen(o)
          if (!o) setPhase('idle')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export video</DialogTitle>
            <DialogDescription>
              {project?.width}×{project?.height} · {project?.fps}fps · {formatTimecode(total)}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {phase === 'idle' && (
              <div className="space-y-3">
                {wcSupported && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEngine('webcodecs')}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors',
                        engine === 'webcodecs' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                      )}
                    >
                      <p className="text-sm font-medium">Best quality</p>
                      <p className="text-[11px] text-muted-foreground">WebCodecs · frame-accurate, faster</p>
                    </button>
                    <button
                      onClick={() => setEngine('realtime')}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors',
                        engine === 'realtime' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                      )}
                    >
                      <p className="text-sm font-medium">Compatible</p>
                      <p className="text-[11px] text-muted-foreground">Realtime recorder · widest support</p>
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {engine === 'webcodecs'
                    ? 'Rendered frame-by-frame for an exact, high-quality MP4.'
                    : 'Rendered in real time. Keep this tab focused during export.'}
                </p>
              </div>
            )}
            {phase === 'exporting' && (
              <div className="space-y-3">
                <Progress value={progress} />
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Rendering… {progress}%
                </p>
              </div>
            )}
            {phase === 'done' && (
              <p className="text-sm text-emerald-500">Done! Your download should have started.</p>
            )}
            {phase === 'error' && <p className="text-sm text-destructive">{error}</p>}

            {phase !== 'exporting' && (
              <div className="mt-4 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CaptionsIcon className="size-4 text-primary" /> Captions
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cueCount > 0
                    ? `Export the ${cueCount} text ${cueCount === 1 ? 'clip' : 'clips'} as a subtitle file.`
                    : 'Add text clips to the timeline to export captions.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cueCount === 0}
                    onClick={() => downloadCaptions('srt')}
                  >
                    Download .srt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cueCount === 0}
                    onClick={() => downloadCaptions('vtt')}
                  >
                    Download .vtt
                  </Button>
                </div>
              </div>
            )}

            {phase !== 'exporting' && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListTree className="size-4 text-primary" /> Edit plan
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {taggedCount > 0
                    ? `Story beats: ${beats.sequence.join(' → ')}`
                    : 'Tag clips with a story role (in clip properties) to plan cutdowns.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={downloadEdl}>
                    Download EDL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={taggedCount === 0}
                    onClick={downloadCutdown}
                  >
                    Download cutdown
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {phase === 'exporting' ? (
              <Button disabled>
                <Loader2 className="size-4 animate-spin" /> Exporting…
              </Button>
            ) : phase === 'done' ? (
              <Button onClick={() => setOpen(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={run}>
                  <Download className="size-4" /> Start export
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'irie-cut-export'
}
