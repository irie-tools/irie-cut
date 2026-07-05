import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Clapperboard, Plus, Trash2, Film, Clock, Upload, Download, CircleHelp } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { ClientOnly } from '#/components/client-only'
import type { Project } from '#/types/editor'
import { getAllProjects, deleteProject, getProjectMedia } from '#/lib/storage'
import { exportProjectBundle, importProjectBundle } from '#/lib/project-io'
import { createProject, projectDuration } from '#/stores/editor-store'
import { formatDuration } from '#/lib/media'

export const Route = createFileRoute('/projects')({ component: ProjectsPage })

const PRESETS: Record<string, { width: number; height: number; label: string }> = {
  landscape: { width: 1920, height: 1080, label: 'Landscape · 16:9' },
  vertical: { width: 1080, height: 1920, label: 'Vertical · 9:16' },
  square: { width: 1080, height: 1080, label: 'Square · 1:1' },
}

function ProjectsPage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ProjectsInner />
    </ClientOnly>
  )
}

function ProjectsInner() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('landscape')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  async function handleImport(file: File) {
    setImporting(true)
    try {
      const id = await importProjectBundle(file)
      navigate({ to: '/editor/$projectId', params: { projectId: id } })
    } catch {
      alert('Could not import that file — make sure it is an Irie Cut project (.json).')
    } finally {
      setImporting(false)
    }
  }

  async function handleExport(id: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const { blob, name } = await exportProjectBundle(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'project'}.iriecut.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function refresh() {
    const ps = await getAllProjects()
    setProjects(ps)
    setLoading(false)
    // Pull a cover thumbnail per project (first media asset that has one) for the grid.
    const entries = await Promise.all(
      ps.map(async (p) => {
        try {
          const media = await getProjectMedia(p.id)
          return [p.id, media.find((m) => m.thumbnail)?.thumbnail] as const
        } catch {
          return [p.id, undefined] as const
        }
      }),
    )
    const map: Record<string, string> = {}
    for (const [id, t] of entries) if (t) map[id] = t
    setThumbs(map)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleCreate() {
    setCreating(true)
    const p = PRESETS[preset]
    const project = await createProject(name || 'Untitled project', {
      width: p.width,
      height: p.height,
    })
    setCreating(false)
    setOpen(false)
    navigate({ to: '/editor/$projectId', params: { projectId: project.id } })
  }

  async function handleDelete(id: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
    await deleteProject(id)
    void refresh()
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <Clapperboard className="size-6 text-primary" />
            <span className="whitespace-nowrap text-lg">Irie Cut</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleImport(f)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importing}>
              <Upload className="size-4" /> {importing ? 'Importing…' : 'Project file'}
            </Button>
            <button
              onClick={() => setHelpOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="How importing works"
              title="How importing works"
            >
              <CircleHelp className="size-4" />
            </button>
            <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
            <Button className="energy-cta font-display tracking-wider" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-7">
          <p className="font-display text-sm uppercase tracking-[0.22em] text-primary">
            Your cutting room
          </p>
          <h1 className="font-display mt-1 text-4xl leading-[0.95] sm:text-5xl">Your projects</h1>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-card/30 py-20 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Film className="size-7 text-primary" />
            </div>
            <p className="font-display text-3xl">Nothing cut yet</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Start fresh, or bring in a project file you exported earlier.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => importRef.current?.click()}>
                <Upload className="size-4" /> Project file
              </Button>
              <Button className="energy-cta font-display tracking-wider" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> New project
              </Button>
            </div>
            <button
              onClick={() => setHelpOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <CircleHelp className="size-4" /> Not sure how? See how importing works
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/editor/$projectId"
                params={{ projectId: p.id }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-black/40"
              >
                <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-[#221d16] to-black">
                  {thumbs[p.id] ? (
                    <img src={thumbs[p.id]} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <Film className="size-9 text-primary/40" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      {formatDuration(projectDuration(p))} · {p.width}×{p.height}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => handleExport(p.id, e)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      aria-label="Export project file"
                      title="Export project (.json)"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Delete project"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Choose a name and canvas size.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                value={name}
                placeholder="Untitled project"
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Canvas</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v ?? 'landscape')}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string | null) => (v ? PRESETS[v]?.label : 'Select')}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESETS).map(([key, v]) => (
                    <SelectItem key={key} value={key}>
                      {v.label} ({v.width}×{v.height})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create & open'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

function ImportHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">Bringing your work into Irie Cut</DialogTitle>
          <DialogDescription>
            Irie Cut projects are portable. Export one as a file, and open it again here or on another
            device — nothing uploads to a server; it&apos;s all read right here in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2 text-sm">
          <section>
            <p className="font-display flex items-center gap-2 text-lg tracking-wide text-primary">
              <Upload className="size-4" /> Project file
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>Open any project and click the export icon (or export from this page).</li>
              <li>
                That saves a{' '}
                <code className="rounded bg-secondary px-1 py-0.5 text-xs">.iriecut.json</code> file — your
                whole project, portable.
              </li>
              <li>
                Back here, click <strong className="text-foreground">Project file</strong> and choose that
                file to reopen it.
              </li>
            </ol>
          </section>
        </div>

        <DialogFooter>
          <Button className="energy-cta font-display tracking-wider" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
