import { createFileRoute } from '@tanstack/react-router'
import { ClientOnly } from '#/components/client-only'
import { Editor } from '#/components/editor/editor'

export const Route = createFileRoute('/editor/$projectId')({ component: EditorPage })

function EditorPage() {
  const { projectId } = Route.useParams()
  return (
    <ClientOnly
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading editor…
        </div>
      }
    >
      <Editor projectId={projectId} />
    </ClientOnly>
  )
}
