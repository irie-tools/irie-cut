import { useState } from 'react'
import { Gauge, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useEditorStore } from '#/stores/editor-store'
import { scoreProject, type CheckStatus } from '#/lib/score'
import { cn } from '#/lib/utils'

const STATUS_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle }
const STATUS_COLOR: Record<CheckStatus, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-destructive',
}

function scoreColor(n: number): string {
  if (n >= 80) return 'text-emerald-400'
  if (n >= 55) return 'text-amber-400'
  return 'text-destructive'
}

export function ScoreButton() {
  const [open, setOpen] = useState(false)
  const project = useEditorStore((s) => s.project)
  const card = project ? scoreProject(project) : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Export readiness"
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Gauge className="size-4" />
        {card && <span className={cn('font-semibold tabular-nums', scoreColor(card.overall))}>{card.overall}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export readiness</DialogTitle>
            <DialogDescription>
              Deterministic checks for the cut, captions, audio, and platform export.
            </DialogDescription>
          </DialogHeader>

          {card && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <div className={cn('font-heading text-5xl font-semibold tabular-nums', scoreColor(card.overall))}>
                  {card.overall}
                </div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        card.overall >= 80 ? 'bg-emerald-500' : card.overall >= 55 ? 'bg-amber-500' : 'bg-destructive',
                      )}
                      style={{ width: `${card.overall}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">out of 100</p>
                </div>
              </div>

              <CheckGroup title="Creative shape" checks={card.checks.filter((c) => (c.group ?? 'creative') === 'creative')} />
              <CheckGroup title="Export checks" checks={card.checks.filter((c) => c.group === 'readiness')} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CheckGroup({ title, checks }: { title: string; checks: ReturnType<typeof scoreProject>['checks'] }) {
  if (!checks.length) return null
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-2">
        {checks.map((c) => {
          const Icon = STATUS_ICON[c.status]
          return (
            <li key={c.id} className="flex gap-2.5">
              <Icon className={cn('mt-0.5 size-4 shrink-0', STATUS_COLOR[c.status])} />
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
