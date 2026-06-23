import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
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
import { formatTimecode } from '#/lib/media'

type Phase = 'idle' | 'exporting' | 'done' | 'error'

export function ExportButton() {
  const project = useEditorStore((s) => s.project)
  const getMediaUrl = useEditorStore((s) => s.getMediaUrl)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const total = projectDuration(project)
  const empty = total <= 0

  async function run() {
    if (!project) return
    setPlaying(false)
    setPhase('exporting')
    setProgress(0)
    setError('')
    try {
      const { blob, extension } = await exportProject(project, getMediaUrl, (f) =>
        setProgress(Math.round(f * 100)),
      )
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
      <Button size="sm" onClick={() => setOpen(true)} disabled={empty}>
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
              <p className="text-sm text-muted-foreground">
                Your timeline will be rendered in real time and downloaded when finished.
                Keep this tab focused during export.
              </p>
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
