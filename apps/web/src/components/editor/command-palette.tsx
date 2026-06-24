import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { useEditorStore } from '#/stores/editor-store'
import { cn } from '#/lib/utils'

interface Command {
  id: string
  label: string
  hint?: string
  run: () => void
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Space', label: 'Play / pause' },
  { keys: '⌘K', label: 'Command palette' },
  { keys: 'S', label: 'Split clip at playhead' },
  { keys: 'M', label: 'Add marker' },
  { keys: '⌘C / ⌘V', label: 'Copy / paste clips' },
  { keys: '⌘D', label: 'Duplicate clip' },
  { keys: 'Delete', label: 'Delete selection' },
  { keys: '← / →', label: 'Step playhead one frame' },
  { keys: 'Shift + ← / →', label: 'Step playhead one second' },
  { keys: 'Alt + ← / →', label: 'Nudge selected clip' },
  { keys: '⌘Z / ⌘⇧Z', label: 'Undo / redo' },
  { keys: 'Shift-click', label: 'Add clip to selection' },
  { keys: '?', label: 'Keyboard shortcuts' },
]

/** ⌘K command palette + keyboard-shortcut cheat sheet. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const s = () => useEditorStore.getState()
    return [
      { id: 'play', label: 'Play / pause', hint: 'Space', run: () => s().togglePlay() },
      { id: 'split', label: 'Split clip at playhead', hint: 'S', run: () => s().splitAtPlayhead() },
      { id: 'dup', label: 'Duplicate clip', hint: '⌘D', run: () => { const id = s().selectedClipId; if (id) s().duplicateClip(id) } },
      { id: 'copy', label: 'Copy selection', hint: '⌘C', run: () => s().copySelection() },
      { id: 'paste', label: 'Paste', hint: '⌘V', run: () => s().pasteClipboard() },
      { id: 'delete', label: 'Delete selection', hint: 'Del', run: () => s().deleteSelection() },
      { id: 'text', label: 'Add text', run: () => s().addTextClip() },
      { id: 'rect', label: 'Add rectangle', run: () => s().addShapeClip('rect') },
      { id: 'ellipse', label: 'Add ellipse', run: () => s().addShapeClip('ellipse') },
      { id: 'arrow', label: 'Add arrow', run: () => s().addShapeClip('arrow') },
      { id: 'marker', label: 'Add marker at playhead', hint: 'M', run: () => s().addMarker(s().currentTime) },
      { id: 'beats', label: 'Detect beats on selected clip', run: () => { const id = s().selectedClipId; if (id) void s().detectBeats(id) } },
      { id: 'pulse', label: 'Pulse cover to the beat', run: () => { const id = s().selectedClipId; if (id) void s().pulseToBeats(id) } },
      { id: 'clearMarkers', label: 'Clear all markers', run: () => s().clearMarkers() },
      { id: 'zoomIn', label: 'Zoom in', run: () => s().setZoom(s().zoom * 1.3) },
      { id: 'zoomOut', label: 'Zoom out', run: () => s().setZoom(s().zoom / 1.3) },
      { id: 'undo', label: 'Undo', hint: '⌘Z', run: () => s().undo() },
      { id: 'redo', label: 'Redo', hint: '⌘⇧Z', run: () => s().redo() },
      { id: 'shortcuts', label: 'Keyboard shortcuts', hint: '?', run: () => setShortcutsOpen(true) },
    ]
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target
      const inField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
      } else if (!inField && e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  function runCommand(c: Command) {
    setOpen(false)
    c.run()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] max-w-lg translate-y-0 gap-0 p-0" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Command palette</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) runCommand(filtered[0])
              }}
              placeholder="Type a command…"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No commands</p>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => runCommand(c)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
                    i === 0 && query && 'bg-accent',
                  )}
                >
                  <span>{c.label}</span>
                  {c.hint && <span className="text-[10px] text-muted-foreground">{c.hint}</span>}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1.5 py-2">
            {SHORTCUTS.map((sc) => (
              <div key={sc.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{sc.label}</span>
                <kbd className="rounded border border-border bg-accent px-1.5 py-0.5 text-[11px] font-medium">{sc.keys}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
