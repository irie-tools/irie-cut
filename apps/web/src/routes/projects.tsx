import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Clapperboard,
  Plus,
  Trash2,
  Film,
  Clock,
  Upload,
  Download,
} from 'lucide-react'
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
import { getAllProjects, deleteProject } from '#/lib/storage'
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
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
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

  async function handleExport(id: string, e: React.MouseEvent) {
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
    setProjects(await getAllProjects())
    setLoading(false)
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

  async function handleDelete(id: string, e: React.MouseEvent) {
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
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Clapperboard className="size-6 text-primary" />
            <span className="text-lg">Irie Cut</span>
          </Link>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
              <Upload className="size-4" /> {importing ? 'Importing…' : 'Import'}
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 font-heading text-3xl font-semibold">Your projects</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <Film className="mb-4 size-10 text-muted-foreground" />
            <p className="text-lg font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start editing.
            </p>
            <Button className="mt-6" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/editor/$projectId"
                params={{ projectId: p.id }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
              >
                <div className="flex aspect-video items-center justify-center bg-black/40">
                  <Film className="size-10 text-muted-foreground/50" />
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
    </div>
  )
}
