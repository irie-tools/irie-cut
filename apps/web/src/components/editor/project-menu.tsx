import { useEffect, useState } from 'react'
import { useEditorStore } from '#/stores/editor-store'

/** Inline-editable project title shown in the editor header. */
export function ProjectMenu() {
  const project = useEditorStore((s) => s.project)
  const updateProject = useEditorStore((s) => s.updateProject)
  const [value, setValue] = useState(project?.name ?? '')

  useEffect(() => {
    setValue(project?.name ?? '')
  }, [project?.name])

  if (!project) return null

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => updateProject({ name: value.trim() || 'Untitled project' })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="w-48 truncate rounded-md bg-transparent px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-accent focus:bg-accent"
      aria-label="Project name"
    />
  )
}
