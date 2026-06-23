import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Clapperboard } from 'lucide-react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { useEditorStore } from '#/stores/editor-store'
import { usePlayback } from '#/hooks/use-playback'
import { MediaPanel } from './media-panel'
import { PreviewPanel } from './preview-panel'
import { PropertiesPanel } from './properties-panel'
import { Timeline } from './timeline'
import { ProjectMenu } from './project-menu'
import { ExportButton } from './export-dialog'

export function Editor({ projectId }: { projectId: string }) {
  const loadProject = useEditorStore((s) => s.loadProject)
  const closeProject = useEditorStore((s) => s.closeProject)
  const project = useEditorStore((s) => s.project)
  const loading = useEditorStore((s) => s.loading)

  usePlayback()

  useEffect(() => {
    void loadProject(projectId)
    return () => closeProject()
  }, [projectId, loadProject, closeProject])

  // Global keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      const s = useEditorStore.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        s.togglePlay()
      } else if (e.key === 's' || e.key === 'S') {
        s.splitAtPlayhead()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedClipId) {
          e.preventDefault()
          s.deleteClip(s.selectedClipId)
        }
      } else if (e.key === 'ArrowRight') {
        s.setCurrentTime(s.currentTime + (e.shiftKey ? 1 : 1 / (project?.fps ?? 30)))
      } else if (e.key === 'ArrowLeft') {
        s.setCurrentTime(s.currentTime - (e.shiftKey ? 1 : 1 / (project?.fps ?? 30)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project?.fps])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading editor…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Link to="/projects" className="text-sm text-primary underline">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Link
            to="/projects"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Back to projects"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Clapperboard className="size-5 text-primary" />
          <ProjectMenu />
        </div>
        <ExportButton />
      </header>

      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize="62%" minSize="30%">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="22%" minSize="15%" maxSize="35%">
              <MediaPanel />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="56%" minSize="30%">
              <PreviewPanel />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="22%" minSize="15%" maxSize="35%">
              <PropertiesPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="38%" minSize="20%">
          <Timeline />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
