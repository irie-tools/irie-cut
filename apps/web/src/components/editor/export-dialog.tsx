import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, Captions as CaptionsIcon, ListTree, Megaphone, XCircle } from 'lucide-react'
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
import { exportAllSizes, PLATFORM_SIZES, type SizePreset } from '#/lib/exporter-multi'
import { buildCaptionText, buildPosterFromCanvas } from '#/lib/post-kit'
import * as storage from '#/lib/storage'
import { formatTimecode } from '#/lib/media'
import { cn } from '#/lib/utils'
import { buildSrt, buildVtt, buildCues } from '#/lib/captions'
import { buildEdl, buildCutdown, beatSummary } from '#/lib/beats'
import { scoreProject, type CheckStatus } from '#/lib/score'

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
  // Multi-size: pre-check the size matching the project's current aspect.
  const [sizes, setSizes] = useState<Set<string>>(() => {
    const ratio = project ? project.width / project.height : 1
    const match = PLATFORM_SIZES.find((s) => Math.abs(s.w / s.h - ratio) < 0.02)
    return new Set(match ? [match.id] : [])
  })
  const [sizeNote, setSizeNote] = useState('')
  const chosenSizes: SizePreset[] = PLATFORM_SIZES.filter((s) => sizes.has(s.id))
  const multi = engine === 'webcodecs' && wcSupported && chosenSizes.length > 0

  function toggleSize(id: string) {
    setSizes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const total = projectDuration(project)
  const empty = total <= 0
  const cueCount = project ? buildCues(project).length : 0

  const beats = project ? beatSummary(project) : { counts: {}, sequence: [] }
  const taggedCount = beats.sequence.length
  const scorecard = project ? scoreProject(project) : null
  const readinessChecks = scorecard?.checks.filter((c) => c.group === 'readiness') ?? []
  const readinessIssues = readinessChecks.filter((c) => c.status !== 'good')

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

  function saveCaption() {
    if (!project) return
    download(buildCaptionText(project), 'caption.txt', 'text/plain;charset=utf-8')
  }

  async function savePoster() {
    if (!project) return
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    const blob = await buildPosterFromCanvas(canvas)
    if (blob) downloadBlob(blob, `${sanitize(project.name)}-poster.jpg`)
  }

  async function run() {
    if (!project) return
    setPlaying(false)
    setPhase('exporting')
    setProgress(0)
    setError('')
    try {
      if (multi) {
        const items = await exportAllSizes(
          project,
          getMediaUrl,
          (id) => storage.getMediaBlob(id),
          chosenSizes,
          (f, size) => {
            setProgress(Math.round(f * 100))
            setSizeNote(size.label)
          },
        )
        for (const it of items) downloadBlob(it.blob, `${sanitize(project.name)}-${it.size.id}.${it.extension}`)
      } else {
        const onP = (f: number) => setProgress(Math.round(f * 100))
        const { blob, extension } =
          engine === 'webcodecs' && wcSupported
            ? await exportProjectWebCodecs(project, getMediaUrl, (id) => storage.getMediaBlob(id), onP, {})
            : await exportProject(project, getMediaUrl, onP)
        downloadBlob(blob, `${sanitize(project.name)}.${extension}`)
      }
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
                {scorecard && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ReadinessIcon status={readinessIssues.some((c) => c.status === 'bad') ? 'bad' : readinessIssues.length ? 'warn' : 'good'} />
                        Export readiness
                      </div>
                      <span className={cn('text-sm font-semibold tabular-nums', scorecard.overall >= 80 ? 'text-emerald-400' : scorecard.overall >= 55 ? 'text-amber-400' : 'text-destructive')}>
                        {scorecard.overall}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {(readinessIssues.length ? readinessIssues.slice(0, 3) : readinessChecks.slice(0, 2)).map((c) => (
                        <div key={c.id} className="flex gap-2 text-xs">
                          <ReadinessIcon status={c.status} small />
                          <span className="text-muted-foreground">{c.detail}</span>
                        </div>
                      ))}
                    </div>
                    {readinessIssues.length > 3 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {readinessIssues.length - 3} more {readinessIssues.length - 3 === 1 ? 'issue' : 'issues'} in the header score panel.
                      </p>
                    )}
                  </div>
                )}
                {engine === 'webcodecs' && wcSupported && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">Platform sizes</p>
                    <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">
                      One timeline → every size. Each is re-framed and exported as its own MP4.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PLATFORM_SIZES.map((s) => {
                        const on = sizes.has(s.id)
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleSize(s.id)}
                            aria-pressed={on}
                            className={cn(
                              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                              on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                              {on && <span className="text-[9px]">✓</span>}
                            </span>
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {phase === 'exporting' && (
              <div className="space-y-3">
                <Progress value={progress} />
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Rendering{multi && sizeNote ? ` ${sizeNote}` : ''}… {progress}%
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

            {phase !== 'exporting' && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Megaphone className="size-4 text-primary" /> Post kit
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {project?.promo?.campaign
                    ? 'Caption + hashtags from your Pam campaign, plus a poster of the current frame.'
                    : 'A ready-to-post caption + hashtags, plus a poster of the current frame.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={saveCaption}>
                    Save caption
                  </Button>
                  <Button size="sm" variant="outline" onClick={savePoster}>
                    Save poster (current frame)
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

function ReadinessIcon({ status, small = false }: { status: CheckStatus; small?: boolean }) {
  const cls = cn(small ? 'mt-0.5 size-3 shrink-0' : 'size-4 shrink-0', status === 'good' ? 'text-emerald-400' : status === 'warn' ? 'text-amber-400' : 'text-destructive')
  if (status === 'good') return <CheckCircle2 className={cls} />
  if (status === 'warn') return <AlertTriangle className={cls} />
  return <XCircle className={cls} />
}
